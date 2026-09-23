import { createHash } from "node:crypto";

export function normalizeCanonicalText(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  return text.replace(/\r\n?/g, "\n");
}

export function canonicalTextBytes(value) {
  return Buffer.from(normalizeCanonicalText(value), "utf8");
}

export function sha256CanonicalText(value) {
  return createHash("sha256").update(canonicalTextBytes(value)).digest("hex");
}

export function gitBlobOidCanonicalText(value) {
  const bytes = canonicalTextBytes(value);
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}
