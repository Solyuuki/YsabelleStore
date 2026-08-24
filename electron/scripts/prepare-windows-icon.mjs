import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const electronRoot = path.resolve(scriptDirectory, "..");
const repoRoot = path.resolve(electronRoot, "..");
const brandRoot = path.join(repoRoot, "frontend", "public", "brand");
const outputPath = path.join(electronRoot, "build", "icon.ico");

const FRAME_SOURCES = [
  [16, "favicon-16x16.png"],
  [32, "favicon-32x32.png"],
  [48, "favicon-48x48.png"],
  [256, "ysabelle-store-mark.png"]
];

function readPngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Windows icon source must be a PNG image.");
  }
  if (buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Windows icon source PNG must begin with IHDR.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

export function buildWindowsIco(frames) {
  if (!Array.isArray(frames) || frames.length === 0 || frames.length > 65535) {
    throw new Error("Windows ICO requires between 1 and 65535 image frames.");
  }

  const directorySize = 6 + frames.length * 16;
  const totalSize = directorySize + frames.reduce((sum, frame) => sum + frame.png.length, 0);
  const ico = Buffer.alloc(totalSize);

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(frames.length, 4);

  let dataOffset = directorySize;
  frames.forEach((frame, index) => {
    if (!Number.isInteger(frame.size) || frame.size < 1 || frame.size > 256) {
      throw new Error(`${frame.name} has an unsupported Windows icon size.`);
    }

    const { width, height } = readPngDimensions(frame.png);
    if (width !== frame.size || height !== frame.size) {
      throw new Error(`${frame.name} must be exactly ${frame.size}x${frame.size}px.`);
    }

    const entryOffset = 6 + index * 16;
    const encodedSize = frame.size === 256 ? 0 : frame.size;
    ico.writeUInt8(encodedSize, entryOffset);
    ico.writeUInt8(encodedSize, entryOffset + 1);
    ico.writeUInt8(0, entryOffset + 2);
    ico.writeUInt8(0, entryOffset + 3);
    ico.writeUInt16LE(1, entryOffset + 4);
    ico.writeUInt16LE(32, entryOffset + 6);
    ico.writeUInt32LE(frame.png.length, entryOffset + 8);
    ico.writeUInt32LE(dataOffset, entryOffset + 12);
    frame.png.copy(ico, dataOffset);
    dataOffset += frame.png.length;
  });

  return ico;
}

export async function prepareWindowsIcon() {
  const frames = [];
  for (const [size, name] of FRAME_SOURCES) {
    frames.push({ size, name, png: await readFile(path.join(brandRoot, name)) });
  }

  const ico = buildWindowsIco(frames);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, ico);
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const generatedPath = await prepareWindowsIcon();
  console.log(`Prepared Windows icon: ${generatedPath}`);
}
