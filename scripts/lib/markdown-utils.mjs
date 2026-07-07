import fs from "node:fs";
import path from "node:path";

export const AUTO_START = "<!-- AUTO-UPDATE:START -->";
export const AUTO_END = "<!-- AUTO-UPDATE:END -->";

export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric"
  }).format(new Date());
}

export function ensureMarkdownFile(filePath, heading) {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `# ${heading}\n\n`, "utf8");
}

export function updateAutoSection(
  filePath,
  generatedContent,
  heading = "Automated Progress Update"
) {
  const normalizedContent = generatedContent.trim();
  const block = `${AUTO_START}\n${normalizedContent}\n${AUTO_END}`;
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const markerPattern = new RegExp(`${escapeRegex(AUTO_START)}[\\s\\S]*?${escapeRegex(AUTO_END)}`);

  if (markerPattern.test(current)) {
    fs.writeFileSync(filePath, current.replace(markerPattern, block), "utf8");
    return;
  }

  const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n";
  fs.writeFileSync(filePath, `${current}${separator}\n## ${heading}\n\n${block}\n`, "utf8");
}

export function readAutoSection(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const content = fs.readFileSync(filePath, "utf8");
  const start = content.indexOf(AUTO_START);
  const end = content.indexOf(AUTO_END);

  if (start < 0 || end < start) {
    return "";
  }

  return content.slice(start + AUTO_START.length, end).trim();
}

export function markdownList(items, emptyText = "None detected") {
  if (!items.length) {
    return emptyText;
  }

  return items.join("<br>");
}

export function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/\r?\n/g, "<br>");
}

export function table(headers, rows) {
  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`)
  ].join("\n");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
