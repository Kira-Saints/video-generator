// lib/captions.ts

export interface Scene {
  text: string;
  image_query: string;
}

function formatTimestamp(totalSeconds: number): string {
  const ms = Math.round((totalSeconds % 1) * 1000);
  const totalWholeSeconds = Math.floor(totalSeconds);
  const s = totalWholeSeconds % 60;
  const m = Math.floor(totalWholeSeconds / 60) % 60;
  const h = Math.floor(totalWholeSeconds / 3600);

  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Build an SRT file's contents from the scenes, giving each scene an
 * equal, sequential slot of `secondsPerScene` seconds.
 */
export function generateSRT(scenes: Scene[], secondsPerScene: number): string {
  const blocks = scenes.map((scene, index) => {
    const start = index * secondsPerScene;
    const end = start + secondsPerScene;
    return [
      String(index + 1),
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      scene.text.trim(),
      "",
    ].join("\n");
  });

  return blocks.join("\n");
}
