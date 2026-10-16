import type { CatalogImageEngineResult } from "../modules/catalog-image/catalogImageEngineRunner.js";

/**
 * Explain a blocked auto-approval without weakening the storefront image gate.
 * Product image diagnostics are supplied by our local Python engine, never by
 * user-authored metadata. Do not expose filesystem paths or internal exceptions.
 */
export function describePackageImageQualityFailure(result: CatalogImageEngineResult): string {
  const source =
    result.source.width && result.source.height
      ? `${result.source.width}×${result.source.height}`
      : "unknown";
  const processed = result.variants?.processed
    ? `${result.variants.processed.width}×${result.variants.processed.height}`
    : "unavailable";
  const warningsOnly =
    result.diagnostics.length > 0 &&
    result.diagnostics.every((diagnostic) => diagnostic.severity !== "error");
  const summary = warningsOnly
    ? "Image requires review; it did not qualify for automatic approval."
    : "Image failed automatic catalog quality approval.";
  const reasons = result.diagnostics
    .slice(0, 5)
    .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
  const explanation = reasons.length
    ? `Reasons: ${reasons.join(" | ")}`
    : "The engine returned no specific rejection diagnostic.";
  return `${summary} Source: ${source}; processed: ${processed}. ${explanation}`;
}
