import type { BrowserWindowConstructorOptions } from "electron";

type SafeWebPreferences = NonNullable<BrowserWindowConstructorOptions["webPreferences"]>;

export function createSafeWebPreferences(
  preloadPath: string,
  packaged: boolean
): SafeWebPreferences {
  return {
    allowRunningInsecureContent: false,
    contextIsolation: true,
    devTools: !packaged,
    nodeIntegration: false,
    preload: preloadPath,
    sandbox: true,
    webSecurity: true
  };
}
