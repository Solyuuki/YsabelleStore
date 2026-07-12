import type { DesktopApi } from "../preload/api.js";

declare global {
  interface Window {
    electron: DesktopApi;
    ysabelleStore: DesktopApi;
  }
}

export {};
