import { BrowserWindow, app, nativeImage } from "electron";
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
  const applicationIconPath = getApplicationIconPath(app.isPackaged);
  const applicationIcon = nativeImage.createFromPath(applicationIconPath);

  if (applicationIcon.isEmpty()) {
    console.warn(`YsabelleStore application icon could not be loaded from ${applicationIconPath}.`);
  }

  const mainWindow = new BrowserWindow({
    ...windowDefaults,
    show: false,
    title: appMetadata.appName,
    icon: applicationIcon.isEmpty() ? applicationIconPath : applicationIcon,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: createSafeWebPreferences(preloadPath, app.isPackaged)
  });

  if (process.platform === "win32") {
    mainWindow.setIcon(applicationIcon.isEmpty() ? applicationIconPath : applicationIcon);
    mainWindow.setAppDetails({
      appId: appMetadata.appUserModelId,
      appIconIndex: 0,
      appIconPath: applicationIconPath
    });
  }

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
