export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCode(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalCode(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = normalizeCode(value);

  return normalized.length > 0 ? normalized : undefined;
}
