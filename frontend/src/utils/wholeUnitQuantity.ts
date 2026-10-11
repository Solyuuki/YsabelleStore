/**
 * Stock and purchasable-unit quantities are non-negative whole numbers.
 * Keep money (PHP), package size, weights, volumes and percentages separate.
 *
 * Reject instead of rounding/truncating: 1.4 units must never become 1 or 2.
 */
export function parseWholeUnitQuantity(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Empty drafts are permitted while editing; fractional or unsafe integers are not. */
export function isWholeUnitDraft(value: string): boolean {
  return value === "" || parseWholeUnitQuantity(value) !== null;
}

/** Use this at submit boundaries; invalid input must not silently change quantity. */
export function requireWholeUnitQuantity(value: string | number, name: string, minimum = 0) {
  const parsed = parseWholeUnitQuantity(value);
  if (parsed === null || parsed < minimum) {
    throw new Error(
      `${name}: enter a whole number of units${minimum > 0 ? ` (at least ${minimum})` : ""}.`
    );
  }
  return parsed;
}
