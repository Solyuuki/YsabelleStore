import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, ipcMain, type PrinterInfo, type WebContents } from "electron";

import {
  getPackagedRendererIndexPath,
  getPreloadBundlePath,
  getRendererDevUrl
} from "../config/paths.js";
import { createSafeWebPreferences } from "../security/defaults.js";
import {
  receiptPrinterSelectChannel,
  receiptPrinterStatusChannel,
  receiptPrintDataChannel,
  receiptPrintReadyChannel,
  receiptPrintRequestChannel
} from "../ipc/channels.js";
import type {
  ReceiptPrintPayload,
  ReceiptPrintResult,
  ReceiptPrinterInfo,
  ReceiptPrinterSelectionSource,
  ReceiptPrinterStatus
} from "../types/receipt.js";

type PendingReceiptPrint = {
  payload: ReceiptPrintPayload;
  printWindow: BrowserWindow;
  resolve: (value: ReceiptPrintResult) => void;
  settled: boolean;
  timeout: NodeJS.Timeout;
};

type ReceiptPrinterConfig = {
  deviceName: string;
  updatedAt: string;
};

type ResolvedPrinter = {
  activePrinter: PrinterInfo | null;
  availablePrinters: PrinterInfo[];
  selectedPrinterName: string | null;
  source: ReceiptPrinterSelectionSource;
};

const RECEIPT_PRINTER_CONFIG_FILENAME = "receipt-printer.json";
const PRINT_TIMEOUT_MS = 15_000;
const pendingPrints = new Map<string, PendingReceiptPrint>();

const RECEIPT_PRINTER_HINTS = [
  "receipt",
  "thermal",
  "pos",
  "xprinter",
  "x-printer",
  "xp-",
  "epson tm",
  "tm-t",
  "star tsp",
  "tsp",
  "bixolon",
  "rongta",
  "gprinter",
  "citizen ct",
  "rp58",
  "rp80"
];

const VIRTUAL_PRINTER_HINTS = [
  "microsoft print to pdf",
  "microsoft xps",
  "onenote",
  "fax",
  "pdf writer",
  "adobe pdf"
];

function resolveReceiptPrintUrl(requestId: string) {
  const rendererDevUrl = getRendererDevUrl();
  const url = rendererDevUrl
    ? new URL(rendererDevUrl)
    : pathToFileURL(getPackagedRendererIndexPath());

  url.searchParams.set("print", "receipt");
  url.searchParams.set("requestId", requestId);

  return url.toString();
}

function getReceiptPrinterConfigPath() {
  return join(app.getPath("userData"), RECEIPT_PRINTER_CONFIG_FILENAME);
}

async function readReceiptPrinterConfig(): Promise<ReceiptPrinterConfig | null> {
  try {
    const raw = await readFile(getReceiptPrinterConfigPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("deviceName" in parsed) ||
      typeof parsed.deviceName !== "string" ||
      !parsed.deviceName.trim()
    ) {
      return null;
    }

    return {
      deviceName: parsed.deviceName,
      updatedAt:
        "updatedAt" in parsed && typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString()
    };
  } catch {
    return null;
  }
}

async function writeReceiptPrinterConfig(deviceName: string) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    getReceiptPrinterConfigPath(),
    `${JSON.stringify(
      {
        deviceName,
        updatedAt: new Date().toISOString()
      } satisfies ReceiptPrinterConfig,
      null,
      2
    )}\n`,
    "utf8"
  );
}

function normalizePrinterText(printer: PrinterInfo) {
  return `${printer.name} ${printer.displayName ?? ""} ${printer.description ?? ""}`.toLowerCase();
}

function isVirtualPrinter(printer: PrinterInfo) {
  const text = normalizePrinterText(printer);
  return VIRTUAL_PRINTER_HINTS.some((hint) => text.includes(hint));
}

function isLikelyReceiptPrinter(printer: PrinterInfo) {
  const text = normalizePrinterText(printer);
  return RECEIPT_PRINTER_HINTS.some((hint) => text.includes(hint));
}

function findPrinterByName(printers: PrinterInfo[], deviceName: string) {
  const normalizedName = deviceName.trim().toLowerCase();
  return (
    printers.find((printer) => printer.name.toLowerCase() === normalizedName) ??
    printers.find((printer) => printer.displayName?.toLowerCase() === normalizedName) ??
    null
  );
}

function chooseAutomaticPrinter(printers: PrinterInfo[]) {
  const physicalPrinters = printers.filter((printer) => !isVirtualPrinter(printer));

  return (
    physicalPrinters.find(isLikelyReceiptPrinter) ??
    (physicalPrinters.length === 1 ? physicalPrinters[0] : null)
  );
}

async function resolveReceiptPrinter(webContents: WebContents): Promise<ResolvedPrinter> {
  const availablePrinters = await webContents.getPrintersAsync();
  const savedConfig = await readReceiptPrinterConfig();

  if (savedConfig) {
    return {
      activePrinter: findPrinterByName(availablePrinters, savedConfig.deviceName),
      availablePrinters,
      selectedPrinterName: savedConfig.deviceName,
      source: "saved"
    };
  }

  const automaticPrinter = chooseAutomaticPrinter(availablePrinters);
  if (!automaticPrinter) {
    return {
      activePrinter: null,
      availablePrinters,
      selectedPrinterName: null,
      source: "none"
    };
  }

  await writeReceiptPrinterConfig(automaticPrinter.name);
  return {
    activePrinter: automaticPrinter,
    availablePrinters,
    selectedPrinterName: automaticPrinter.name,
    source: "auto"
  };
}

function toReceiptPrinterInfo(printer: PrinterInfo): ReceiptPrinterInfo {
  return {
    description: printer.description ?? "",
    displayName: printer.displayName || printer.name,
    name: printer.name
  };
}

async function getReceiptPrinterStatus(webContents: WebContents): Promise<ReceiptPrinterStatus> {
  const resolved = await resolveReceiptPrinter(webContents);

  return {
    activePrinterName: resolved.activePrinter?.name ?? null,
    availablePrinters: resolved.availablePrinters.map(toReceiptPrinterInfo),
    isAvailable: Boolean(resolved.activePrinter),
    selectedPrinterName: resolved.selectedPrinterName,
    source: resolved.source
  };
}

function createReceiptPrintWindow(requestId: string) {
  const printWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    height: 860,
    show: false,
    title: "Receipt print",
    width: 420,
    webPreferences: createSafeWebPreferences(getPreloadBundlePath(), app.isPackaged)
  });

  printWindow.on("closed", () => {
    const entry = pendingPrints.get(requestId);

    if (!entry) {
      return;
    }

    if (!entry.settled) {
      entry.settled = true;
      clearTimeout(entry.timeout);
      entry.resolve({
        printed: false,
        printerName: null,
        reason: "PRINT_WINDOW_CLOSED",
        requestId
      });
    }

    pendingPrints.delete(requestId);
  });

  return printWindow;
}

async function printWindowContents(printWindow: BrowserWindow) {
  const resolved = await resolveReceiptPrinter(printWindow.webContents);
  const printer = resolved.activePrinter;

  if (!printer) {
    return {
      printed: false,
      printerName: resolved.selectedPrinterName,
      reason: resolved.selectedPrinterName ? "PRINTER_UNAVAILABLE" : "NO_RECEIPT_PRINTER"
    };
  }

  return await new Promise<{
    printed: boolean;
    printerName: string;
    reason: string | null;
  }>((resolve) => {
    printWindow.webContents.print(
      {
        deviceName: printer.name,
        printBackground: true,
        silent: true
      },
      (success, failureReason) => {
        resolve({
          printed: success,
          printerName: printer.name,
          reason: success ? null : failureReason || "PRINT_FAILED"
        });
      }
    );
  });
}

function settlePrint(requestId: string, result: Omit<ReceiptPrintResult, "requestId">) {
  const entry = pendingPrints.get(requestId);

  if (!entry || entry.settled) {
    return;
  }

  entry.settled = true;
  clearTimeout(entry.timeout);
  entry.resolve({
    ...result,
    requestId
  });
  pendingPrints.delete(requestId);

  if (!entry.printWindow.isDestroyed()) {
    entry.printWindow.destroy();
  }
}

export function registerReceiptPrintIpc() {
  ipcMain.handle(receiptPrinterStatusChannel, async (event) => {
    return getReceiptPrinterStatus(event.sender);
  });

  ipcMain.handle(receiptPrinterSelectChannel, async (event, printerName: string) => {
    const printers = await event.sender.getPrintersAsync();
    const selectedPrinter = findPrinterByName(printers, printerName);

    if (!selectedPrinter) {
      throw new Error("Selected receipt printer is unavailable.");
    }

    await writeReceiptPrinterConfig(selectedPrinter.name);
    return getReceiptPrinterStatus(event.sender);
  });

  ipcMain.handle(receiptPrintRequestChannel, async (_, payload: ReceiptPrintPayload) => {
    const requestId = randomUUID();
    const printWindow = createReceiptPrintWindow(requestId);

    return await new Promise<ReceiptPrintResult>((resolve) => {
      const timeout = setTimeout(() => {
        settlePrint(requestId, {
          printed: false,
          printerName: null,
          reason: "PRINT_TIMEOUT"
        });
      }, PRINT_TIMEOUT_MS);

      pendingPrints.set(requestId, {
        payload,
        printWindow,
        resolve,
        settled: false,
        timeout
      });

      void printWindow.loadURL(resolveReceiptPrintUrl(requestId)).catch(() => {
        settlePrint(requestId, {
          printed: false,
          printerName: null,
          reason: "PRINT_RENDER_FAILED"
        });
      });
    });
  });

  ipcMain.handle(receiptPrintDataChannel, async (_, requestId: string) => {
    return pendingPrints.get(requestId)?.payload ?? null;
  });

  ipcMain.handle(receiptPrintReadyChannel, async (_, requestId: string) => {
    const entry = pendingPrints.get(requestId);

    if (!entry || entry.settled) {
      return {
        printed: false,
        printerName: null,
        reason: "PRINT_REQUEST_NOT_FOUND",
        requestId
      } satisfies ReceiptPrintResult;
    }

    try {
      const result = await printWindowContents(entry.printWindow);
      settlePrint(requestId, result);

      return {
        ...result,
        requestId
      } satisfies ReceiptPrintResult;
    } catch {
      const result = {
        printed: false,
        printerName: null,
        reason: "PRINT_FAILED"
      };
      settlePrint(requestId, result);

      return {
        ...result,
        requestId
      } satisfies ReceiptPrintResult;
    }
  });
}
