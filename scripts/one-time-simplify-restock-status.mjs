import { readFileSync, writeFileSync } from "node:fs";

const path = "frontend/src/components/reports/RestockForecastPanel.tsx";
let source = readFileSync(path, "utf8");

const riskVariantBlock = `function riskVariant(risk: RestockForecastRisk | null | undefined) {
  if (risk === "CRITICAL" || risk === "HIGH") return "danger" as const;
  if (risk === "MEDIUM") return "warning" as const;
  if (risk === "LOW") return "success" as const;
  return "default" as const;
}
`;

const helper = `${riskVariantBlock}
function stockStatusLabel(candidate: RestockPlanningCandidate) {
  if (candidate.recommendedQuantity <= 0) return "Stock OK";

  switch (candidate.forecastDecision?.riskLevel) {
    case "CRITICAL":
      return "Urgent";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Needs review";
  }
}
`;

if (!source.includes("function stockStatusLabel")) {
  if (!source.includes(riskVariantBlock)) throw new Error("riskVariant block not found");
  source = source.replace(riskVariantBlock, helper);
}

source = source.replace("<TableHead>Risk</TableHead>", "<TableHead>Status</TableHead>");
source = source.replace(
  `{item.forecastDecision?.riskLevel ?? "MONITOR"}`,
  `{stockStatusLabel(item)}`
);
source = source.replace(
  `{selected.forecastDecision?.riskLevel ?? sourceLabel(selected)}`,
  `{stockStatusLabel(selected)}`
);

writeFileSync(path, source);
