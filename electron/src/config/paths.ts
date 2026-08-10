import path from "node:path";
import { fileURLToPath } from "node:url";

const mainFilePath = fileURLToPath(import.meta.url);
const configDirectory = path.dirname(mainFilePath);
const defaultRendererDevUrl = "http://localhost:5173";

export function getPreloadBundlePath(): string {
  return path.join(configDirectory, "../preload/index.cjs");
}

export function getRendererDevUrl(): string | undefined {
  const rendererDevUrl = process.env.ELECTRON_RENDERER_DEV_URL?.trim();
  if (rendererDevUrl) return rendererDevUrl;

  return process.env.NODE_ENV === "production" ? undefined : defaultRendererDevUrl;
}

export function getRendererDistIndexPath(): string {
  return path.join(configDirectory, "../../../frontend/dist/index.html");
}

export function getPackagedRendererIndexPath(): string {
  return path.join(process.resourcesPath, "frontend", "index.html");
}
