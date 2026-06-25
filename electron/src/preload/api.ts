import { contextBridge, ipcRenderer } from "electron";
import { isAllowedIpcChannel } from "../ipc/channels.js";

export interface DesktopApi {
  isElectron: true;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  platform: NodeJS.Platform;
}

export function createDesktopApi(): DesktopApi {
  return Object.freeze({
    isElectron: true as const,
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
  contextBridge.exposeInMainWorld("ysabelleStore", createDesktopApi());
}
