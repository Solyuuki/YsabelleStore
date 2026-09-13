from pathlib import Path
import re

reports_path = Path("frontend/src/pages/ReportsPage.tsx")
forecast_path = Path("frontend/src/components/reports/RestockForecastPanel.tsx")
test_path = Path("scripts/restock-phase7-9-ui-contract-test.ts")

reports = reports_path.read_text()
forecast = forecast_path.read_text()
test = test_path.read_text()

reports_header = '''            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <h2 className="text-base font-semibold text-slate-950">Restock forecast</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Automatic SARIMAX-driven recommendations are shown below before projected stockouts.
                Manual custom restocking stays in the separate Restock planner.
              </p>
            </div>

'''
assert reports_header in reports, "Reports forecast header not found"
reports = reports.replace(reports_header, "", 1)

forecast = forecast.replace(
    "{ includeZero: false, page: 1, pageSize: 100 },",
    "{ includeZero: true, page: 1, pageSize: 100 },",
    1,
)

selected_block = '''  const selected = useMemo(
    () => items.find((item) => item.product.id === selectedProductId) ?? null,
    [items, selectedProductId]
  );'''
assert selected_block in forecast, "Selected block not found"
forecast = forecast.replace(
    selected_block,
    selected_block
    + '''
  const actionableItems = useMemo(
    () => items.filter((item) => item.recommendedQuantity > 0),
    [items]
  );''',
    1,
)

forecast = forecast.replace("items.filter((item) => {", "actionableItems.filter((item) => {")
forecast = forecast.replace("      actionCount: items.length,", "      actionCount: actionableItems.length,", 1)
forecast = forecast.replace(
    "      units: items.reduce((sum, item) => sum + Math.max(0, item.recommendedQuantity), 0)",
    "      units: actionableItems.reduce((sum, item) => sum + Math.max(0, item.recommendedQuantity), 0)",
    1,
)
forecast = forecast.replace("  }, [items]);", "  }, [actionableItems]);", 1)

empty_block = re.compile(r'\n  if \(items\.length === 0\) \{[\s\S]*?\n  \}\n\n  return \(')
forecast, count = empty_block.subn("\n  return (", forecast, count=1)
assert count == 1, "Empty-state block not found"

return_block = re.compile(r'  return \(\n    <div className="space-y-3">[\s\S]*?\n  \);\n}\n\nfunction ForecastMetric')
replacement = '''  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Restock forecast</CardTitle>
              <Badge variant={summary.actionCount > 0 ? "warning" : "success"}>
                {summary.actionCount > 0
                  ? `${summary.actionCount.toLocaleString()} need action`
                  : "Stock covered"}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Automatic SARIMAX-driven demand intelligence stays visible even when current stock
              does not require a restock. Manual custom restocking stays in the separate Restock
              planner.
            </p>
          </div>
          <Button
            disabled={loading}
            onClick={() => setLocalRefreshVersion((version) => version + 1)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ForecastMetric label="Needs action" value={summary.actionCount} />
          <ForecastMetric label="High risk" value={summary.highRisk} />
          <ForecastMetric label="Stockout within 7d" value={summary.sevenDayStockouts} />
          <ForecastMetric label="Suggested units" value={summary.units} />
        </div>

        {summary.actionCount === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-950">No restock action required</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Current sellable and incoming stock cover the active forecast demand. Forecast charts
              remain available below for monitoring.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">Forecast watchlist</p>
              <p className="mt-1 text-xs text-slate-500">
                Forecast-ready products stay visible here even when suggested restock is zero.
              </p>
            </div>
            <div className="overflow-hidden">
              {items.length > 0 ? (
                <Table aria-label="Forecast product watchlist">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Sellable</TableHead>
                      <TableHead className="text-right">Suggested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.slice(0, 12).map((item) => {
                      const selectedRow = item.product.id === selectedProductId;
                      return (
                        <TableRow
                          className={selectedRow ? "bg-indigo-50/70" : "hover:bg-slate-50"}
                          key={item.product.id}
                        >
                          <TableCell className="max-w-[16rem]">
                            <button
                              className="w-full text-left"
                              onClick={() => setSelectedProductId(item.product.id)}
                              type="button"
                            >
                              <span className="block truncate font-medium text-slate-950">
                                {item.product.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {sourceLabel(item)} · {item.product.sku}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant={riskVariant(item.forecastDecision?.riskLevel)}>
                              {item.forecastDecision?.riskLevel ?? "MONITOR"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(item.sellableStock)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-950">
                            {formatNumber(item.recommendedQuantity)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-950">No forecast products yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    The chart workspace remains ready while forecast history is being built.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {selected?.product.name ?? "Demand forecast"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selected?.forecast
                    ? `${selected.forecast.modelName ?? "SARIMA"} demand forecast · Generated ${formatDate(selected.forecast.generatedAt)}`
                    : "Historical demand, forecast trajectory, and confidence interval."}
                </p>
              </div>
              {selected ? (
                <Badge variant={riskVariant(selected.forecastDecision?.riskLevel)}>
                  {selected.forecastDecision?.riskLevel ?? sourceLabel(selected)}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ForecastMetric
                  compact
                  label="30d demand"
                  value={Math.ceil(
                    selected?.forecastDecision?.currentMonthDemand ??
                      selected?.forecast?.currentMonthDemand ??
                      0
                  )}
                />
                <ForecastMetric compact label="Incoming" value={selected?.incomingStock ?? 0} />
                <ForecastMetric
                  compact
                  label="Stockout"
                  value={formatDate(selected?.forecastDecision?.projectedStockoutDate)}
                />
                <ForecastMetric
                  compact
                  label="Action date"
                  value={formatDate(selected?.forecastDecision?.recommendedActionDate)}
                />
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-sm font-semibold text-slate-950">Demand forecast</p>
                  <p className="text-xs text-slate-500">
                    Historical demand, SARIMAX forecast, and confidence interval.
                  </p>
                </div>
                <div className="relative h-64 rounded-md border border-slate-200 bg-white p-2">
                  {demandChart.length > 0 ? (
                    <ResponsiveContainer height="100%" width="100%">
                      <ComposedChart
                        data={demandChart}
                        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                        <Tooltip
                          formatter={(value, name) => [
                            formatNumber(Number(value), 1),
                            String(name)
                          ]}
                        />
                        <Area
                          dataKey="confidenceBase"
                          fill="transparent"
                          name="Confidence lower"
                          stackId="confidence"
                          stroke="none"
                        />
                        <Area
                          dataKey="confidenceRange"
                          fill="#818cf8"
                          fillOpacity={0.18}
                          name="Confidence interval"
                          stackId="confidence"
                          stroke="none"
                        />
                        <Line
                          connectNulls={false}
                          dataKey="actual"
                          dot={false}
                          name="Historical demand"
                          stroke="#475569"
                          strokeWidth={2}
                          type="monotone"
                        />
                        <Line
                          connectNulls={false}
                          dataKey="forecast"
                          dot={{ r: 2.5 }}
                          name="Forecast demand"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          type="monotone"
                        />
                        {firstForecastPeriod ? (
                          <ReferenceLine
                            label={{ fill: "#64748b", fontSize: 10, value: "Forecast" }}
                            stroke="#94a3b8"
                            strokeDasharray="4 4"
                            x={formatMonth(firstForecastPeriod)}
                          />
                        ) : null}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Forecast chart ready</p>
                        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                          No SARIMAX series is available yet. This chart area remains visible and
                          will populate automatically when forecast history is generated.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {inventoryProjection.length > 1 && selected ? (
                <div>
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-slate-950">Projected inventory</p>
                    <p className="text-xs text-slate-500">
                      Sellable + incoming stock, less expiry exposure and forecast demand.
                    </p>
                  </div>
                  <div className="h-44 rounded-md border border-slate-200 bg-slate-50/40 p-2">
                    <ResponsiveContainer height="100%" width="100%">
                      <LineChart
                        data={inventoryProjection}
                        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" minTickGap={18} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={38} />
                        <Tooltip
                          formatter={(value) => [
                            formatNumber(Number(value), 1),
                            "Projected stock"
                          ]}
                        />
                        <ReferenceLine
                          label={{ fill: "#64748b", fontSize: 10, value: "Target" }}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          y={selected.product.targetStockLevel}
                        />
                        <ReferenceLine
                          label={{ fill: "#b45309", fontSize: 10, value: "Reorder" }}
                          stroke="#d97706"
                          strokeDasharray="4 4"
                          y={selected.product.reorderLevel}
                        />
                        <ReferenceLine stroke="#dc2626" y={0} />
                        <Line
                          dataKey="projectedStock"
                          dot={{ r: 2.5 }}
                          name="Projected stock"
                          stroke="#0f766e"
                          strokeWidth={2.5}
                          type="monotone"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {selected ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Forecast interpretation
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{selected.rationale}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>Sellable {formatNumber(selected.sellableStock)}</span>
                    <span>Incoming {formatNumber(selected.incomingStock)}</span>
                    <span>Expiry exposure {formatNumber(selected.expiryRiskQuantity)}</span>
                    <span>Target {formatNumber(selected.product.targetStockLevel)}</span>
                    <span>Reorder {formatNumber(selected.product.reorderLevel)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastMetric'''
forecast, count = return_block.subn(replacement, forecast, count=1)
assert count == 1, "Forecast return block not found"

if "const forecastSource = readFileSync" not in test:
    test = test.replace(
        '''const planningSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);''',
        '''const planningSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);
const forecastSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockForecastPanel.tsx"),
  "utf8"
);''',
        1,
    )

test = test.replace(
    "assert.match(reportsSource, /Restock forecast/);",
    "assert.match(forecastSource, /Restock forecast/);",
    1,
)
test = test.replace(
    "assert.match(reportsSource, /Automatic SARIMAX-driven recommendations/);",
    "assert.match(forecastSource, /Automatic SARIMAX-driven demand intelligence/);",
    1,
)
if "assert.match(forecastSource, /Forecast watchlist/);" not in test:
    test = test.replace(
        "assert.match(reportsSource, /RestockForecastPanel/);",
        '''assert.match(reportsSource, /RestockForecastPanel/);
assert.match(forecastSource, /Forecast watchlist/);
assert.match(forecastSource, /includeZero: true/);
assert.match(forecastSource, /Forecast chart ready/);''',
        1,
    )

reports_path.write_text(reports)
forecast_path.write_text(forecast)
test_path.write_text(test)
