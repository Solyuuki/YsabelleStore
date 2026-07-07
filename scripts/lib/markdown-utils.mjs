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

export function cleanupAutomatedSections(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const current = fs.readFileSync(filePath, "utf8");
  const cleaned = removeAutomatedSections(current);

  if (cleaned !== current) {
    fs.writeFileSync(filePath, cleaned, "utf8");
  }
}

export function removeAutomatedSections(content) {
  let next = content;

  next = next.replace(
    /\n*## Automated (?:Progress Update|Validation Summary|Sprint Member Update|Sprint Backlog Activity|Validation Status|Latest Sprint Activity)\n\n<!-- AUTO-UPDATE:START -->[\s\S]*?<!-- AUTO-UPDATE:END -->\n*/g,
    "\n\n"
  );
  next = next.replace(/\n*<!-- AUTO-UPDATE:START -->[\s\S]*?<!-- AUTO-UPDATE:END -->\n*/g, "\n\n");
  next = next.replace(/\n{3,}/g, "\n\n");

  return next.trimEnd() + "\n";
}

export function ensureSectionWithTable(filePath, heading, headers) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

  if (findTableAfterHeading(current, heading)) {
    return;
  }

  const section = [`## ${heading}`, "", table(headers, [])].join("\n");
  const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n";
  fs.writeFileSync(filePath, `${current}${separator}\n${section}\n`, "utf8");
}

export function upsertTableRow(filePath, heading, keyColumns, rowByHeader) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const tableInfo = findTableAfterHeading(current, heading);

  if (!tableInfo) {
    const headers = Object.keys(rowByHeader);
    const section = [
      `## ${heading}`,
      "",
      table(headers, [headers.map((header) => rowByHeader[header] ?? "")])
    ].join("\n");
    const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    fs.writeFileSync(filePath, `${current}${separator}\n${section}\n`, "utf8");
    return;
  }

  const rows = tableInfo.rows.filter((row) => row.length > 0);
  const nextRow = tableInfo.headers.map((header) => rowByHeader[header] ?? "");
  const existingIndex = rows.findIndex((row) =>
    keyColumns.every((column) => {
      const columnIndex = tableInfo.headers.indexOf(column);
      return (
        columnIndex >= 0 && normalizeCell(row[columnIndex]) === normalizeCell(rowByHeader[column])
      );
    })
  );

  if (existingIndex >= 0) {
    rows[existingIndex] = nextRow;
  } else {
    rows.push(nextRow);
  }

  const nextTable = table(tableInfo.headers, rows);
  const nextContent = `${current.slice(0, tableInfo.start)}${nextTable}${current.slice(tableInfo.end)}`;
  fs.writeFileSync(filePath, nextContent, "utf8");
}

export function fileContains(filePath, value) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8").includes(value);
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

function findTableAfterHeading(content, heading) {
  const linesWithOffsets = [];
  let offset = 0;

  for (const line of content.split(/\r?\n/)) {
    linesWithOffsets.push({ line, offset });
    offset += line.length + 1;
  }

  const headingIndex = linesWithOffsets.findIndex(({ line }) => line.trim() === `## ${heading}`);

  if (headingIndex < 0) {
    return null;
  }

  let tableStartIndex = -1;

  for (let index = headingIndex + 1; index < linesWithOffsets.length - 1; index += 1) {
    const current = linesWithOffsets[index].line;
    const next = linesWithOffsets[index + 1].line;

    if (index > headingIndex + 1 && /^##\s+/.test(current)) {
      break;
    }

    if (/^\s*\|.*\|\s*$/.test(current) && /^\s*\|[-:\s|]+\|\s*$/.test(next)) {
      tableStartIndex = index;
      break;
    }
  }

  if (tableStartIndex < 0) {
    return null;
  }

  let tableEndIndex = tableStartIndex + 2;

  while (
    tableEndIndex < linesWithOffsets.length &&
    /^\s*\|.*\|\s*$/.test(linesWithOffsets[tableEndIndex].line)
  ) {
    tableEndIndex += 1;
  }

  const start = linesWithOffsets[tableStartIndex].offset;
  const end =
    tableEndIndex < linesWithOffsets.length
      ? linesWithOffsets[tableEndIndex].offset - 1
      : content.length;
  const lines = linesWithOffsets.slice(tableStartIndex, tableEndIndex).map(({ line }) => line);
  const headers = parseTableLine(lines[0]);
  const rows = lines.slice(2).map(parseTableLine);

  return {
    end,
    headers,
    rows,
    start
  };
}

function parseTableLine(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replaceAll("\\|", "|"));
}

function normalizeCell(value) {
  return String(value ?? "")
    .replace(/<br>/g, " ")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
