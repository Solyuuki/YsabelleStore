import fs from "node:fs";

import { writeFileAtomic } from "./atomic-write.mjs";

export function withFileTransaction(filePaths, action) {
  const snapshots = new Map(
    [...new Set(filePaths)].map((filePath) => [
      filePath,
      fs.existsSync(filePath) ? fs.readFileSync(filePath) : null
    ])
  );

  try {
    return action();
  } catch (error) {
    for (const [filePath, content] of snapshots) {
      if (content === null) {
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { force: true });
        }
      } else {
        writeFileAtomic(filePath, content, undefined);
      }
    }
    throw error;
  }
}
