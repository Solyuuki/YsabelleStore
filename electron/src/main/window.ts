import { BrowserWindow, app } from "electron";
import { appMetadata, windowDefaults } from "../config/app.js";
import {
  getApplicationIconPath,
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
  if (app.isPackaged) {
    return {
      kind: "file",
      value: getPackagedRendererIndexPath()
    };
  }

  const rendererDevUrl = getRendererDevUrl();

  if (rendererDevUrl) {
    return {
      kind: "url",
      value: rendererDevUrl
    };
  }

  return {
    kind: "file",
    value: getRendererDistIndexPath()
  };
}

export function createMainWindow(): BrowserWindow {
  const preloadPath = getPreloadBundlePath();
  const smokeTest = process.env.YSABELLE_DEV_SMOKE === "1";
  const mainWindow = new BrowserWindow({
    ...windowDefaults,
    show: false,
    title: appMetadata.appName,
    icon: getApplicationIconPath(app.isPackaged),
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: createSafeWebPreferences(preloadPath, app.isPackaged)
  });

  if (!smokeTest) {
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny"
  }));

  const rendererEntry = resolveRendererEntry();

  if (rendererEntry.kind === "url") {
    void loadDevelopmentRenderer(mainWindow, rendererEntry.value);
  } else {
    void mainWindow.loadFile(rendererEntry.value);
  }

  return mainWindow;
}

async function loadDevelopmentRenderer(mainWindow: BrowserWindow, rendererUrl: string) {
  const attempts = 30;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (mainWindow.isDestroyed()) return;

    try {
      await mainWindow.loadURL(rendererUrl);
      return;
    } catch (error) {
      if (attempt === attempts) {
        console.error(`Electron could not load the renderer at ${rendererUrl}.`, error);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
