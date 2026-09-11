import "electron";

declare module "electron" {
  interface PrinterInfo {
    isDefault?: boolean;
    status?: number;
  }
}

export {};
