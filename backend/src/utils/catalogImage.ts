export function isSupportedCatalogImageUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeCatalogImageUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
