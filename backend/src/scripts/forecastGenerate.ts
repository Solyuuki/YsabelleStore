import {
  getLastForecastPersistenceTimings,
  loadPersistedForecastBatch
} from "../modules/forecasting/forecast-persistence.service.js";
import {
  requestForecastRefresh,
  waitForForecastRefresh
} from "../modules/forecasting/forecast.service.js";

const requestStartedAt = performance.now();
const refresh = await requestForecastRefresh({ force: true });
const backgroundRefreshResponseMs = performance.now() - requestStartedAt;
const active = await waitForForecastRefresh();
const result = active ? await loadPersistedForecastBatch(active.id) : null;

if (!result) {
  throw new Error("Forecast generation completed without an active persisted batch.");
}

console.log(
  JSON.stringify(
    {
      ...result.generation,
      backgroundRefreshResponseMs,
      persistence: getLastForecastPersistenceTimings(),
      refresh
    },
    null,
    2
  )
);

if (result.generation.failedProducts > 0 || result.generation.nanCount > 0) {
  process.exitCode = 1;
}
