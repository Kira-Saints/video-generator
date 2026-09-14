// lib/video-generator.ts

import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import { generateVideoScript, Scene } from "./ai";
import { downloadImageForQuery } from "./pexels";
import { downloadBackgroundMusic } from "./music";
import {
  createSceneVideo,
  concatScenes,
  addBackgroundMusic,
  burnCaptions,
} from "./ffmpeg";
import { generateSRT } from "./captions";

const SECONDS_PER_SCENE = 5;
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 30;

export const BASE_TMP_DIR = path.join(os.tmpdir(), "video-generator");

export function getJobDir(jobId: string): string {
  return path.join(BASE_TMP_DIR, jobId);
}

export function getFinalVideoPath(jobId: string): string {
  return path.join(getJobDir(jobId), "final.mp4");
}

export class VideoGenerationError extends Error {
  /** A short, user-safe message (no internal details / API keys). */
  publicMessage: string;

  constructor(publicMessage: string, cause?: unknown) {
    super(publicMessage);
    this.publicMessage = publicMessage;

    if (cause) {
      console.error("VideoGenerationError cause:", cause);
    }
  }
}

/**
 * Runs the full pipeline for a topic and returns the jobId once the
 * final.mp4 is ready at getFinalVideoPath(jobId).
 */
export async function generateVideo(topic: string): Promise<string> {
  const jobId = randomUUID();
  const jobDir = getJobDir(jobId);

  fs.mkdirSync(jobDir, { recursive: true });

  try {
    // 1. Generate script + scenes + music query.
    let script;

    try {
      script = await generateVideoScript(topic);
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to generate the video script.",
        err
      );
    }

    // 2. Download an image for each scene from Pexels.
    //    Skip scenes whose image cannot be found rather than failing
    //    the whole job.
    const usableScenes: Scene[] = [];
    const imagePaths: string[] = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];

      const imagePath = path.join(
        jobDir,
        `image-${String(i + 1).padStart(2, "0")}.jpg`
      );

      let found = false;

      try {
        found = await downloadImageForQuery(
          scene.image_query,
          imagePath
        );
      } catch (err) {
        console.error(
          `Pexels lookup failed for "${scene.image_query}":`,
          err
        );

        found = false;
      }

      if (found) {
        usableScenes.push(scene);
        imagePaths.push(imagePath);
      }
    }

    if (usableScenes.length === 0) {
      throw new VideoGenerationError("Unable to retrieve images.");
    }

    // 3. Turn each image into a short video clip.
    const sceneVideoPaths: string[] = [];

    try {
      for (let i = 0; i < imagePaths.length; i++) {
        const outputPath = path.join(
          jobDir,
          `scene-${String(i + 1).padStart(2, "0")}.mp4`
        );

        const zoomDirection = i % 2 === 0 ? "in" : "out";

        await createSceneVideo(
          imagePaths[i],
          outputPath,
          SECONDS_PER_SCENE,
          zoomDirection,
          FPS,
          VIDEO_WIDTH,
          VIDEO_HEIGHT
        );

        sceneVideoPaths.push(outputPath);
      }
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to generate the video.",
        err
      );
    }

    // 4. Concatenate scenes into one silent video.
    const concatPath = path.join(jobDir, "concatenated.mp4");

    try {
      await concatScenes(
        sceneVideoPaths,
        concatPath,
        jobDir
      );
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to generate the video.",
        err
      );
    }

    const totalDuration =
      usableScenes.length * SECONDS_PER_SCENE;

    // 5. Generate SRT captions from the scene text.
    const srtPath = path.join(
      jobDir,
      "captions.srt"
    );

    const srtContent = generateSRT(
      usableScenes,
      SECONDS_PER_SCENE
    );

    fs.writeFileSync(
      srtPath,
      srtContent,
      "utf-8"
    );

    // 6. Generate and download background music.
    //    The music is stored temporarily inside the job directory.
    const musicPath = path.join(
      jobDir,
      "background.mp3"
    );

    try {
      await downloadBackgroundMusic(
        script.music_query,
        musicPath
      );
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to retrieve background music.",
        err
      );
    }

    // 7. Add the downloaded background music.
    const withMusicPath = path.join(
      jobDir,
      "with-music.mp4"
    );

    try {
      await addBackgroundMusic(
        concatPath,
        musicPath,
        withMusicPath,
        totalDuration
      );
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to generate the video.",
        err
      );
    }

    // 8. Burn captions into the final video.
    const finalPath = getFinalVideoPath(jobId);

    try {
      await burnCaptions(
        withMusicPath,
        srtPath,
        finalPath
      );
    } catch (err) {
      throw new VideoGenerationError(
        "Unable to generate the video.",
        err
      );
    }

    // 9. Clean up all intermediate files.
    //    Only final.mp4 is kept.
    cleanupIntermediateFiles(
      jobDir,
      finalPath
    );

    return jobId;
  } catch (err) {
    if (err instanceof VideoGenerationError) {
      // Clean up the job directory if generation failed.
      try {
        fs.rmSync(jobDir, {
          recursive: true,
          force: true,
        });
      } catch {
        // Non-fatal cleanup failure.
      }

      throw err;
    }

    // Clean up unexpected failures as well.
    try {
      fs.rmSync(jobDir, {
        recursive: true,
        force: true,
      });
    } catch {
      // Non-fatal cleanup failure.
    }

    throw new VideoGenerationError(
      "Unable to generate the video.",
      err
    );
  }
}

function cleanupIntermediateFiles(
  jobDir: string,
  finalPath: string
) {
  const entries = fs.readdirSync(jobDir);

  for (const entry of entries) {
    const fullPath = path.join(
      jobDir,
      entry
    );

    if (fullPath !== finalPath) {
      try {
        fs.rmSync(fullPath, {
          recursive: true,
          force: true,
        });
      } catch {
        // Non-fatal: leftover temp files don't affect the result.
      }
    }
  }
}