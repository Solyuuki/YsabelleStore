import fs from "node:fs";
import path from "node:path";

export function writeFileAtomic(filePath, content, encoding = "utf8") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const nextContent = Buffer.isBuffer(content) ? content : Buffer.from(content, encoding);

  if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(nextContent)) {
    return false;
  }

  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    fs.writeFileSync(temporaryPath, nextContent);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }

  return true;
}
