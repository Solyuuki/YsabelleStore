import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const panelPath = "frontend/src/components/reports/RestockForecastPanel.tsx";
const demoPath = "frontend/src/components/reports/restockForecastDemo.ts";

let source = readFileSync(panelPath, "utf8");

source = source.replace(
  /import \{\n  createRestockForecastDemo,\n  RESTOCK_FORECAST_DEMO_PRODUCT_ID\n\} from "@\/components\/reports\/restockForecastDemo";\n/,
  ""
);
source = source.replace("  const [demoMode, setDemoMode] = useState(false);\n", "");
source = source.replace(
  /  const displayItems = useMemo\(\n    \(\) => \(demoMode \? \[createRestockForecastDemo\(\)\] : items\),\n    \[demoMode, items\]\n  \);\n/,
  ""
);
source = source.replace(
  "    () => displayItems.find((item) => item.product.id === selectedProductId) ?? null,\n    [displayItems, selectedProductId]\n",
  "    () => items.find((item) => item.product.id === selectedProductId) ?? null,\n    [items, selectedProductId]\n"
);
source = source.replace(
  "    () => displayItems.filter((item) => item.recommendedQuantity > 0),\n    [displayItems]\n",
  "    () => items.filter((item) => item.recommendedQuantity > 0),\n    [items]\n"
);
source = source.replace(
  /\n  const toggleDemoMode = \(\) => \{[\s\S]*?\n  \};\n\n  if \(loading/,
  "\n  if (loading"
);
source = source.replace(
  /\n            \{import\.meta\.env\.DEV \? \(\n              <Button onClick=\{toggleDemoMode\} size="sm" type="button" variant="secondary">\n                \{demoMode \? "Exit test forecast" : "Show test forecast"\}\n              <\/Button>\n            \) : null\}/,
  ""
);
source = source.replace(
  /\n        \{demoMode \? \([\s\S]*?\n        \) : null\}\n/,
  "\n"
);
source = source.replaceAll("displayItems.length", "items.length");
source = source.replaceAll("displayItems.slice", "items.slice");

if (source.includes("demoMode") || source.includes("createRestockForecastDemo") || source.includes("displayItems")) {
  throw new Error("Temporary restock forecast demo references remain after patch.");
}

writeFileSync(panelPath, source);

if (existsSync(demoPath)) {
  rmSync(demoPath);
}

console.log("Removed temporary restock forecast demo UI and fixture.");
