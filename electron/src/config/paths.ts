import path from "node:path";
import { fileURLToPath } from "node:url";

const mainFilePath = fileURLToPath(import.meta.url);
const configDirectory = path.dirname(mainFilePath);

export function getPreloadBundlePath(): string {
  return path.join(configDirectory, "../preload/index.js");
}

export function getRendererDevUrl(): string | undefined {
  const rendererDevUrl = process.env.ELECTRON_RENDERER_DEV_URL?.trim();
  return rendererDevUrl ? rendererDevUrl : undefined;
}

export function getRendererDistIndexPath(): string {
  return path.join(configDirectory, "../../../frontend/dist/index.html");
}

export function getPackagedRendererIndexPath(): string {
  return path.join(process.resourcesPath, "frontend", "index.html");
}
