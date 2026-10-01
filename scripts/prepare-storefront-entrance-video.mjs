import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const source = resolve(
  process.cwd(),
  process.argv[2] ?? "frontend/public/media/store-entrance-source.mp4"
);
const output = resolve(process.cwd(), "frontend/public/media/store-entrance.mp4");

if (!existsSync(source)) {
  console.error(`Store entrance source video not found: ${source}`);
  console.error("Pass a source MP4 path or place it at frontend/public/media/store-entrance-source.mp4.");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });

const filter = [
  "[0:v]trim=start=0:end=2,setpts=PTS-STARTPTS,scale=960:540,fade=t=in:st=0:d=0.18,fade=t=out:st=1.82:d=0.18[v0]",
  "[0:v]trim=start=2:end=8,setpts=PTS-STARTPTS,scale=960:540,fade=t=in:st=0:d=0.18,fade=t=out:st=5.82:d=0.18[v1]",
  "[0:v]trim=start=8:end=10,setpts=PTS-STARTPTS,scale=960:540,fade=t=in:st=0:d=0.18,fade=t=out:st=1.82:d=0.18[v2]",
  "[v0][v1][v2]concat=n=3:v=1:a=0[outv]"
].join(";");

const result = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output
  ],
  { stdio: "inherit" }
);

if (result.error?.code === "ENOENT") {
  console.error("ffmpeg is required to prepare the storefront entrance video.");
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Prepared storefront entrance video: ${output}`);
