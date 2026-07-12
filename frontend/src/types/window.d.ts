import type { RetailReceiptData } from "@/types/receipt";

type DesktopApi = {
  isElectron: true;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  platform: NodeJS.Platform;
  receipt: {
    print(receipt: RetailReceiptData): Promise<unknown>;
  };
};

declare global {
  interface Window {
    electron: DesktopApi;
    ysabelleStore: DesktopApi;
  }
}

export {};
