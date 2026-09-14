// lib/ffmpeg.ts

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Run an ffmpeg command and resolve on success.
 * Logs stderr to the server console (never to the client) on failure.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      // e.g. ffmpeg binary not found
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error("FFmpeg failed. Command:", "ffmpeg", args.join(" "));
        console.error("FFmpeg stderr:\n", stderr);
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

/**
 * Turn a single still image into a short video clip with a subtle
 * slow zoom in/out effect (a "Ken Burns" style slideshow effect).
 */
export async function createSceneVideo(
  imagePath: string,
  outputPath: string,
  durationSeconds: number,
  zoomDirection: "in" | "out" = "in",
  fps = 30,
  width = 1280,
  height = 720
): Promise<void> {
  const totalFrames = Math.round(durationSeconds * fps);

  // Upscale first so the zoom has room to work with, then crop/scale to
  // the exact output size (this also handles cropping non-16:9 images).
  const zoomExpr =
    zoomDirection === "in"
      ? `min(zoom+0.0012,1.15)`
      : `if(eq(on,0),1.15,max(zoom-0.0012,1.0))`;

  const vf = [
    `scale=${width * 3}:${height * 3}:force_original_aspect_ratio=increase`,
    `crop=${width * 3}:${height * 3}`,
    `zoompan=z='${zoomExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
    `format=yuv420p`,
  ].join(",");

  await runFfmpeg([
    "-loop",
    "1",
    "-i",
    imagePath,
    "-vf",
    vf,
    "-t",
    String(durationSeconds),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]);
}

/**
 * Concatenate multiple scene videos (all same codec/resolution/fps) into one.
 */
export async function concatScenes(
  sceneVideoPaths: string[],
  outputPath: string,
  jobDir: string
): Promise<void> {
  const listPath = path.join(jobDir, "concat-list.txt");
  const listContent = sceneVideoPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent, "utf-8");

  await runFfmpeg([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

/**
 * Add background music underneath the (silent) video, looping and
 * trimming it to match the video's duration, at a reasonable volume.
 */
export async function addBackgroundMusic(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  durationSeconds: number,
  musicVolume = 0.35
): Promise<void> {
  await runFfmpeg([
    "-i",
    videoPath,
    "-stream_loop",
    "-1",
    "-i",
    musicPath,
    "-t",
    String(durationSeconds),
    "-filter_complex",
    `[1:a]volume=${musicVolume}[music]`,
    "-map",
    "0:v",
    "-map",
    "[music]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);
}

/**
 * Burn an SRT subtitle file directly into the video (hardcoded captions).
 */
export async function burnCaptions(
  videoPath: string,
  srtPath: string,
  outputPath: string
): Promise<void> {
  // ffmpeg's subtitles filter needs the path escaped for filter syntax,
  // especially on Windows where drive letters/backslashes confuse it.
  const escapedSrtPath = srtPath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:");

  const style = [
    "FontName=Arial",
    "FontSize=22",
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00000000",
    "BorderStyle=1",
    "Outline=2",
    "Shadow=0",
    "Alignment=2",
    "MarginV=40",
  ].join(",");

  await runFfmpeg([
    "-i",
    videoPath,
    "-vf",
    `subtitles='${escapedSrtPath}':force_style='${style}'`,
    "-c:a",
    "copy",
    outputPath,
  ]);
}
