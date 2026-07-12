import { contextBridge, ipcRenderer } from "electron";
import { isAllowedIpcChannel, receiptPrintRequestChannel } from "../ipc/channels.js";
import type { ReceiptPrintPayload } from "../types/receipt.js";

export interface DesktopApi {
  isElectron: true;
  receipt: {
    print(receipt: ReceiptPrintPayload): Promise<unknown>;
  };
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  platform: NodeJS.Platform;
}

export function createDesktopApi(): DesktopApi {
  return Object.freeze({
    isElectron: true as const,
    receipt: {
      print(receipt: ReceiptPrintPayload): Promise<unknown> {
        return ipcRenderer.invoke(receiptPrintRequestChannel, receipt);
      }
    },
    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
      if (!isAllowedIpcChannel(channel)) {
        return Promise.reject(new Error(`Unsupported IPC channel: ${channel}`));
      }

      return ipcRenderer.invoke(channel, ...args);
    },
    platform: process.platform
  });
}

export function exposeDesktopApi(): void {
  const api = createDesktopApi();

  contextBridge.exposeInMainWorld("ysabelleStore", api);
  contextBridge.exposeInMainWorld("electron", api);
}
