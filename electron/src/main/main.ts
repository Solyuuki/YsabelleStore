import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(currentDirectory, "../preload/index.js")
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_DEV_URL;

  if (rendererUrl) {
    void window.loadURL(rendererUrl);
    return;
  }

  const rendererFile = app.isPackaged
    ? path.join(process.resourcesPath, "frontend", "index.html")
    : path.join(currentDirectory, "../../../frontend/dist/index.html");

  void window.loadFile(rendererFile);
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
