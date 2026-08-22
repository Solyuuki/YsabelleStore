import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_IMAGE_ENGINE_SCRIPT = path.resolve(
  currentDirectory,
  "../../../../catalog-image-engine/app/main.py"
);
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const STATUS_VALUES = new Set(["APPROVED", "NEEDS_REVIEW", "REJECTED"] as const);
const SEVERITY_VALUES = new Set(["info", "warning", "error"] as const);
const VARIANT_FILE_NAMES = new Set(["processed.webp", "card.webp", "pdp.webp"]);

export type CatalogImageQualityStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED";

export type CatalogImageDiagnostic = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

type CatalogImageDimensions = {
  width: number;
  height: number;
};

type CatalogImageVariantResult = CatalogImageDimensions & {
  fileName: string;
};

export type CatalogImageEngineResult = {
  status: CatalogImageQualityStatus;
  source: {
    width: number | null;
    height: number | null;
    mode: string | null;
  };
  diagnostics: CatalogImageDiagnostic[];
  metrics: {
    luminance: number | null;
    contrastStdDev: number | null;
    sharpnessRms: number | null;
    foregroundOccupancy: number | null;
    touchesSafeMargin: boolean | null;
  };
  orientedSource?: CatalogImageDimensions;
  upscaleFactor?: {
    card: number;
    pdp: number;
  };
  variants?: {
    processed: CatalogImageVariantResult;
    card: CatalogImageVariantResult;
    pdp: CatalogImageVariantResult;
  };
};

function invalidResult(): never {
  throw new HttpError(502, "Catalog image engine returned an invalid result.", {
    code: "CATALOG_IMAGE_INVALID_RESULT"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function nullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && typeof value === "number" && value > 0);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function parseDimensions(value: unknown): CatalogImageDimensions {
  if (!isRecord(value) || !positiveInteger(value.width) || !positiveInteger(value.height)) {
    invalidResult();
  }
  return { width: value.width, height: value.height };
}

function parseVariant(value: unknown, expectedFileName: string): CatalogImageVariantResult {
  if (!isRecord(value) || value.fileName !== expectedFileName) {
    invalidResult();
  }
  const dimensions = parseDimensions(value);
  if (!VARIANT_FILE_NAMES.has(value.fileName)) {
    invalidResult();
  }
  return { fileName: value.fileName, ...dimensions };
}

export function parseCatalogImageEngineOutput(stdout: string): CatalogImageEngineResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    invalidResult();
  }

  if (!isRecord(parsed) || typeof parsed.status !== "string" || !STATUS_VALUES.has(parsed.status as never)) {
    invalidResult();
  }
  if (!isRecord(parsed.source)) invalidResult();
  if (
    !nullablePositiveInteger(parsed.source.width) ||
    !nullablePositiveInteger(parsed.source.height) ||
    !(parsed.source.mode === null || typeof parsed.source.mode === "string")
  ) {
    invalidResult();
  }
  if (!Array.isArray(parsed.diagnostics)) invalidResult();
  const diagnostics = parsed.diagnostics.map((item): CatalogImageDiagnostic => {
    if (
      !isRecord(item) ||
      typeof item.code !== "string" ||
      item.code.length === 0 ||
      typeof item.message !== "string" ||
      item.message.length === 0 ||
      typeof item.severity !== "string" ||
      !SEVERITY_VALUES.has(item.severity as never)
    ) {
      invalidResult();
    }
    return {
      code: item.code,
      message: item.message,
      severity: item.severity as CatalogImageDiagnostic["severity"]
    };
  });
  if (!isRecord(parsed.metrics)) invalidResult();
  const metrics = parsed.metrics;
  if (
    !nullableNumber(metrics.luminance) ||
    !nullableNumber(metrics.contrastStdDev) ||
    !nullableNumber(metrics.sharpnessRms) ||
    !nullableNumber(metrics.foregroundOccupancy) ||
    !(metrics.touchesSafeMargin === null || typeof metrics.touchesSafeMargin === "boolean")
  ) {
    invalidResult();
  }

  const result: CatalogImageEngineResult = {
    status: parsed.status as CatalogImageQualityStatus,
    source: {
      width: parsed.source.width,
      height: parsed.source.height,
      mode: parsed.source.mode
    },
    diagnostics,
    metrics: {
      luminance: metrics.luminance,
      contrastStdDev: metrics.contrastStdDev,
      sharpnessRms: metrics.sharpnessRms,
      foregroundOccupancy: metrics.foregroundOccupancy,
      touchesSafeMargin: metrics.touchesSafeMargin
    }
  };

  if (parsed.variants !== undefined) {
    if (!isRecord(parsed.variants)) invalidResult();
    result.variants = {
      processed: parseVariant(parsed.variants.processed, "processed.webp"),
      card: parseVariant(parsed.variants.card, "card.webp"),
      pdp: parseVariant(parsed.variants.pdp, "pdp.webp")
    };

    if (!isRecord(parsed.orientedSource) || !isRecord(parsed.upscaleFactor)) invalidResult();
    result.orientedSource = parseDimensions(parsed.orientedSource);
    if (
      typeof parsed.upscaleFactor.card !== "number" ||
      !Number.isFinite(parsed.upscaleFactor.card) ||
      parsed.upscaleFactor.card <= 0 ||
      parsed.upscaleFactor.card > 1.25 ||
      typeof parsed.upscaleFactor.pdp !== "number" ||
      !Number.isFinite(parsed.upscaleFactor.pdp) ||
      parsed.upscaleFactor.pdp <= 0 ||
      parsed.upscaleFactor.pdp > 1.25
    ) {
      invalidResult();
    }
    result.upscaleFactor = {
      card: parsed.upscaleFactor.card,
      pdp: parsed.upscaleFactor.pdp
    };
  }

  return result;
}

export async function runCatalogImageEngine(sourcePath: string, outputDirectory: string) {
  const requestBody = JSON.stringify({ sourcePath, outputDirectory });

  return await new Promise<CatalogImageEngineResult>((resolve, reject) => {
    const child = spawn(env.PYTHON_EXECUTABLE, [CATALOG_IMAGE_ENGINE_SCRIPT], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let outputOverflow = false;

    const finishReject = (error: HttpError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finishReject(
        new HttpError(504, "Catalog image processing timed out.", {
          code: "CATALOG_IMAGE_PROCESS_TIMEOUT"
        })
      );
    }, env.CATALOG_IMAGE_PROCESS_TIMEOUT_MS);

    const appendBounded = (current: string, chunk: string) => {
      const combined = current + chunk;
      if (Buffer.byteLength(combined, "utf8") > MAX_PROCESS_OUTPUT_BYTES) {
        outputOverflow = true;
        child.kill("SIGTERM");
        return current;
      }
      return combined;
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.stdin.on("error", () => {
      // Startup/exit errors are handled by child error/close events.
    });
    child.on("error", () => {
      finishReject(
        new HttpError(503, "Catalog image engine could not be started.", {
          code: "CATALOG_IMAGE_PROCESS_UNAVAILABLE"
        })
      );
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;

      if (outputOverflow) {
        reject(
          new HttpError(502, "Catalog image engine output exceeded the safe limit.", {
            code: "CATALOG_IMAGE_OUTPUT_TOO_LARGE"
          })
        );
        return;
      }
      if (code !== 0) {
        if (stderr.trim()) {
          console.error(`[catalog-image] Python process exited with code ${String(code)}:`, stderr.slice(0, 600));
        }
        reject(
          new HttpError(502, "Catalog image engine failed to process the image.", {
            code: "CATALOG_IMAGE_PROCESS_FAILED"
          })
        );
        return;
      }

      try {
        resolve(parseCatalogImageEngineOutput(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(requestBody);
  });
}
