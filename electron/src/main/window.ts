import { BrowserWindow, app } from "electron";
import { appMetadata, windowDefaults } from "../config/app.js";
import {
  getPackagedRendererIndexPath,
  getPreloadBundlePath,
  getRendererDevUrl,
  getRendererDistIndexPath
} from "../config/paths.js";
import { createSafeWebPreferences } from "../security/defaults.js";

type RendererEntry = {
  kind: "file" | "url";
  value: string;
};

function resolveRendererEntry(): RendererEntry {
  const rendererDevUrl = getRendererDevUrl();

  if (rendererDevUrl) {
    return {
      kind: "url",
      value: rendererDevUrl
    };
  }

  if (app.isPackaged) {
    return {
      kind: "file",
      value: getPackagedRendererIndexPath()
    };
  }

  return {
    kind: "file",
    value: getRendererDistIndexPath()
  };
}

export function createMainWindow(): BrowserWindow {
  const preloadPath = getPreloadBundlePath();
  const mainWindow = new BrowserWindow({
    ...windowDefaults,
    show: false,
    title: appMetadata.appName,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: createSafeWebPreferences(preloadPath, app.isPackaged)
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny"
  }));

  const rendererEntry = resolveRendererEntry();

  if (rendererEntry.kind === "url") {
    void mainWindow.loadURL(rendererEntry.value);
  } else {
    void mainWindow.loadFile(rendererEntry.value);
  }

  return mainWindow;
}
