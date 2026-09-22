import { spawn } from "node:child_process";
import os from "node:os";

import { env } from "../../config/env.js";
import { HTTP_STATUS } from "../../constants/httpStatusContract.js";
import { HttpError } from "../../utils/httpError.js";
import type { ProductForecastDetail, ProductHistoricalSeries } from "./forecast.types.js";
import { getActiveForecastMonth } from "./forecast-window.js";
import { loadReconstructedComparisonSales } from "./historical-sales.service.js";
import { resolveRepositoryPath } from "./repository-paths.js";

type PythonForecastResponse = {
  products: ProductForecastDetail[];
};

const FORECASTING_SCRIPT = resolveRepositoryPath("forecasting-service/app/main.py");
const WORKBOOK_PRODUCT_ID_PREFIX = "workbook:";
const FORECAST_PROCESS_STARTUP_GRACE_MS = 30_000;

function parsePythonJson(stdout: string): PythonForecastResponse {
  try {
    const parsed = JSON.parse(stdout) as Partial<PythonForecastResponse>;

    if (!Array.isArray(parsed.products)) {
      throw new Error("Missing products array.");
    }

    return {
      products: parsed.products
    };
  } catch {
    throw new HttpError(HTTP_STATUS.BAD_GATEWAY, "Forecast service returned invalid JSON.", {
      code: "FORECAST_INVALID_JSON"
    });
  }
}

async function withReconstructedComparisons(products: ProductHistoricalSeries[]) {
  if (!products.some((product) => product.productId.startsWith(WORKBOOK_PRODUCT_ID_PREFIX))) {
    return products;
  }

  const reconstructed = await loadReconstructedComparisonSales();
  if (!reconstructed.available) {
    return products;
  }

  return products.map((product) => {
    if (!product.productId.startsWith(WORKBOOK_PRODUCT_ID_PREFIX)) {
      return product;
    }

    const sourceProductId = product.productId.slice(WORKBOOK_PRODUCT_ID_PREFIX.length);
    const comparisonHistorical = reconstructed.products.get(sourceProductId);

    return comparisonHistorical?.length ? { ...product, comparisonHistorical } : product;
  });
}

export function forecastProcessTimeoutMs(productCount: number) {
  if (productCount <= 0) return env.FORECAST_PROCESS_TIMEOUT_MS;

  const workerCount = Math.max(
    1,
    Math.min(productCount, env.FORECAST_WORKERS, os.cpus().length || 1, 4)
  );
  const worstCaseFitWaves = Math.ceil(productCount / workerCount);
  const computedBudget =
    worstCaseFitWaves * env.SARIMA_FIT_TIMEOUT_SECONDS * 1000 + FORECAST_PROCESS_STARTUP_GRACE_MS;

  return Math.max(env.FORECAST_PROCESS_TIMEOUT_MS, computedBudget);
}

export async function runPythonForecast(products: ProductHistoricalSeries[]) {
  const timeoutMs = forecastProcessTimeoutMs(products.length);
  const pythonExecutable = env.PYTHON_EXECUTABLE;
  const forecastProducts = await withReconstructedComparisons(products);
  const requestBody = JSON.stringify({
    forecastStartPeriod: getActiveForecastMonth(),
    horizon: env.FORECAST_DEFAULT_HORIZON,
    products: forecastProducts,
    seasonalPeriod: env.FORECAST_SEASONAL_PERIOD
  });

  return await new Promise<PythonForecastResponse>((resolve, reject) => {
    const child = spawn(pythonExecutable, [FORECASTING_SCRIPT], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      reject(
        new HttpError(HTTP_STATUS.GATEWAY_TIMEOUT, "Forecast service timed out.", {
          code: "FORECAST_PROCESS_TIMEOUT"
        })
      );
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdin.on("error", () => {
      // Process startup/exit errors are reported by the child error/close handlers.
    });
    child.on("error", () => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(
          new HttpError(HTTP_STATUS.SERVICE_UNAVAILABLE, "Forecast service could not be started.", {
            code: "FORECAST_PROCESS_UNAVAILABLE"
          })
        );
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);

      if (settled) {
        return;
      }

      settled = true;

      if (code !== 0) {
        if (stderr.trim()) {
          console.error(
            `[forecast] Python process exited with code ${String(code)}:`,
            stderr.slice(0, 600)
          );
        }

        reject(
          new HttpError(HTTP_STATUS.BAD_GATEWAY, "Forecast service failed to generate forecasts.", {
            code: "FORECAST_PROCESS_FAILED"
          })
        );
        return;
      }

      resolve(parsePythonJson(stdout));
    });

    child.stdin.end(requestBody);
  });
}
