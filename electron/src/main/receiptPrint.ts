import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { app, BrowserWindow, ipcMain } from "electron";

import {
  getPackagedRendererIndexPath,
  getPreloadBundlePath,
  getRendererDevUrl
} from "../config/paths.js";
import { createSafeWebPreferences } from "../security/defaults.js";
import {
  receiptPrintDataChannel,
  receiptPrintReadyChannel,
  receiptPrintRequestChannel
} from "../ipc/channels.js";
import type { ReceiptPrintPayload } from "../types/receipt.js";

type ReceiptPrintResult = {
  printed: boolean;
  requestId: string;
};

type PendingReceiptPrint = {
  payload: ReceiptPrintPayload;
  printWindow: BrowserWindow;
  resolve: (value: ReceiptPrintResult) => void;
  settled: boolean;
};

const pendingPrints = new Map<string, PendingReceiptPrint>();

function resolveReceiptPrintUrl(requestId: string) {
  const rendererDevUrl = getRendererDevUrl();
  const url = rendererDevUrl
    ? new URL(rendererDevUrl)
    : pathToFileURL(getPackagedRendererIndexPath());

  url.searchParams.set("print", "receipt");
  url.searchParams.set("requestId", requestId);

  return url.toString();
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
      entry.resolve({
        printed: false,
        requestId
      });
    }

    pendingPrints.delete(requestId);
  });

  return printWindow;
}

function printWindowContents(printWindow: BrowserWindow) {
  return new Promise<boolean>((resolve) => {
    printWindow.webContents.print(
      {
        printBackground: true,
        silent: false
      },
      (success) => {
        resolve(success);
      }
    );
  });
}

function settlePrint(requestId: string, printed: boolean) {
  const entry = pendingPrints.get(requestId);

  if (!entry || entry.settled) {
    return;
  }

  entry.settled = true;
  entry.resolve({
    printed,
    requestId
  });
  pendingPrints.delete(requestId);
}

export function registerReceiptPrintIpc() {
  ipcMain.handle(receiptPrintRequestChannel, async (_, payload: ReceiptPrintPayload) => {
    const requestId = randomUUID();
    const printWindow = createReceiptPrintWindow(requestId);

    return await new Promise<ReceiptPrintResult>((resolve) => {
      pendingPrints.set(requestId, {
        payload,
        printWindow,
        resolve,
        settled: false
      });

      void printWindow.loadURL(resolveReceiptPrintUrl(requestId));
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
        requestId
      };
    }

    const printed = await printWindowContents(entry.printWindow);
    settlePrint(requestId, printed);

    return {
      printed,
      requestId
    };
  });
}
