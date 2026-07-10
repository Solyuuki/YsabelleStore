import { spawn } from "node:child_process";

import { env } from "../../config/env.js";
import { HttpError } from "../../utils/httpError.js";
import type { ProductForecastDetail, ProductHistoricalSeries } from "./forecast.types.js";
import { resolveRepositoryPath } from "./repository-paths.js";

type PythonForecastResponse = {
  products: ProductForecastDetail[];
};

const FORECASTING_SCRIPT = resolveRepositoryPath("forecasting-service/app/main.py");

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
    throw new HttpError(502, "Forecast service returned invalid JSON.", {
      code: "FORECAST_INVALID_JSON"
    });
  }
}

export async function runPythonForecast(products: ProductHistoricalSeries[]) {
  const timeoutMs = env.FORECAST_PROCESS_TIMEOUT_MS;
  const pythonExecutable = env.PYTHON_EXECUTABLE;
  const requestBody = JSON.stringify({
    horizon: env.FORECAST_DEFAULT_HORIZON,
    products,
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
        new HttpError(504, "Forecast service timed out.", {
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
    child.on("error", () => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(
          new HttpError(503, "Forecast service could not be started.", {
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
        reject(
          new HttpError(502, "Forecast service failed to generate forecasts.", {
            code: "FORECAST_PROCESS_FAILED",
            details: stderr.slice(0, 600)
          })
        );
        return;
      }

      resolve(parsePythonJson(stdout));
    });

    child.stdin.end(requestBody);
  });
}
