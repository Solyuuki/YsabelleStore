import { app, BrowserWindow } from "electron";
import { appMetadata } from "../config/app.js";
import { createMainWindow } from "./window.js";

function wireAppLifecycle(): void {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

void app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appMetadata.appUserModelId);
  }

  wireAppLifecycle();
  void createMainWindow();
});
