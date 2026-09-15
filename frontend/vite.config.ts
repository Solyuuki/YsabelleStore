import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

function getManualChunk(id: string) {
  const normalizedId = id.replace(/\\/g, "/");

  if (
    normalizedId.includes("/node_modules/react/") ||
    normalizedId.includes("/node_modules/react-dom/") ||
    normalizedId.includes("/node_modules/scheduler/")
  ) {
    return "vendor-react";
  }

  return undefined;
}

export default defineConfig(({ mode }) => {
  const envDirectory = path.resolve(__dirname, "..");
  const loadedEnvironment = loadEnv(mode, envDirectory, "");
  const frontendUrl = new URL(
    process.env.FRONTEND_URL ?? loadedEnvironment.FRONTEND_URL ?? "http://localhost:5173"
  );

  if (!frontendUrl.port) {
    throw new Error("FRONTEND_URL must include the development server port.");
  }

  return {
    base: "./",
    envDir: envDirectory,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getManualChunk
        }
      }
    },
    server: {
      host: frontendUrl.hostname,
      port: Number(frontendUrl.port),
      strictPort: true
    },
    preview: {
      host: frontendUrl.hostname,
      port: 4173,
      strictPort: true
    }
  };
});
