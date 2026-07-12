const HTML_ENTITY_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/&amp;/g, "&"],
  [/&nbsp;/g, " "],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&apos;/g, "'"]
];

const WINDOWS_1252_BYTES = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f]
]);

const MOJIBAKE_MARKERS = /Ã|Â|â(?:€|‚|„|€¦|€™|€œ|€|€“|€”|„¢)|ï¿½|�/u;
const REPLACEMENT_CHARACTER = /\uFFFD|ï¿½/u;

export function hasLikelyMojibake(value: string) {
  return MOJIBAKE_MARKERS.test(value);
}

function mojibakeScore(value: string) {
  let score = 0;

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (char === "Ã" || char === "Â" || char === "�") {
      score += 6;
    } else if (char === "â") {
      score += 5;
    } else if (char === "€" || char === "™" || char === "œ" || char === "") {
      score += 3;
    } else if (codePoint >= 0x80 && codePoint <= 0x9f) {
      score += 4;
    }
  }

  return score;
}

function windows1252ByteFor(char: string) {
  const codePoint = char.codePointAt(0) ?? 0;

  if (WINDOWS_1252_BYTES.has(codePoint)) {
    return WINDOWS_1252_BYTES.get(codePoint)!;
  }

  if (codePoint <= 0xff) {
    return codePoint;
  }

  return null;
}

function decodeAsUtf8FromWindows1252Text(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const byte = windows1252ByteFor(char);

    if (byte === null) {
      return null;
    }

    bytes.push(byte);
  }

  return Buffer.from(bytes).toString("utf8");
}

function repairMojibake(value: string) {
  let best = value;
  let bestScore = mojibakeScore(value);

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeAsUtf8FromWindows1252Text(best);

    if (!decoded || REPLACEMENT_CHARACTER.test(decoded)) {
      break;
    }

    const decodedScore = mojibakeScore(decoded);

    if (decodedScore >= bestScore) {
      break;
    }

    best = decoded;
    bestScore = decodedScore;

    if (!hasLikelyMojibake(best)) {
      break;
    }
  }

  return best;
}

export function normalizeProductName(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  let normalized = String(value);

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized.trim().replace(/\s+/g, " ").normalize("NFC");

  if (hasLikelyMojibake(normalized)) {
    normalized = repairMojibake(normalized).normalize("NFC");
  }

  return normalized;
}
