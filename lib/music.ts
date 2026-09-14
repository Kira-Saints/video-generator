// lib/music.ts

import fs from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const JAMENDO_API_URL = "https://api.jamendo.com/v3.0/tracks/";

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  audio: string;
  audiodownload: string;
  audiodownload_allowed: boolean;
  license_ccurl?: string;
}

interface JamendoResponse {
  headers?: {
    status?: string;
    code?: number;
    error_message?: string;
  };
  results?: JamendoTrack[];
}

/**
 * Search Jamendo for suitable instrumental background music
 * and download one random track.
 *
 * The search progressively becomes broader if no suitable
 * music is found for the original query.
 */
export async function downloadBackgroundMusic(
  musicQuery: string,
  outputPath: string
): Promise<void> {
  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "JAMENDO_CLIENT_ID is not set in the environment."
    );
  }

  const searchQueries = buildSearchQueries(musicQuery);

  let tracks: JamendoTrack[] = [];

  for (const query of searchQueries) {
    console.log(`Searching Jamendo music: "${query}"`);

    try {
      tracks = await searchJamendoTracks(
        clientId,
        query
      );
    } catch (err) {
      console.error(
        `Jamendo search failed for "${query}":`,
        err
      );

      continue;
    }

    if (tracks.length > 0) {
      console.log(
        `Found ${tracks.length} Jamendo track(s) for "${query}".`
      );

      break;
    }
  }

  if (tracks.length === 0) {
    throw new Error(
      `No suitable Jamendo music found for query: "${musicQuery}"`
    );
  }

  // Pick a random track so repeated videos can have different music.
  const track =
    tracks[Math.floor(Math.random() * tracks.length)];

  console.log(
    `Selected Jamendo track: "${track.name}" by ${track.artist_name}`
  );

  const musicResponse = await fetch(
    track.audiodownload
  );

  if (!musicResponse.ok || !musicResponse.body) {
    throw new Error(
      `Failed to download Jamendo track: ${track.name}`
    );
  }

  const fileStream = fs.createWriteStream(
    outputPath
  );

  await pipeline(
    Readable.fromWeb(
      musicResponse.body as any
    ),
    fileStream
  );

  console.log(
    `Background music saved to: ${outputPath}`
  );
}

/**
 * Build progressively broader search queries.
 *
 * Example:
 *
 * "cheerful acoustic folk"
 *
 * becomes:
 *
 * 1. cheerful acoustic folk
 * 2. cheerful acoustic
 * 3. acoustic
 * 4. cheerful
 * 5. instrumental
 */
function buildSearchQueries(
  musicQuery: string
): string[] {
  const words = musicQuery
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const queries: string[] = [];

  if (musicQuery.trim()) {
    queries.push(musicQuery.trim());
  }

  if (words.length >= 2) {
    queries.push(
      words.slice(0, 2).join(" ")
    );
  }

  if (words.length >= 1) {
    queries.push(words[0]);
  }

  queries.push("instrumental");

  // Remove duplicate queries.
  return [...new Set(queries)];
}

/**
 * Search Jamendo for downloadable instrumental tracks.
 */
async function searchJamendoTracks(
  clientId: string,
  query: string
): Promise<JamendoTrack[]> {
  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "20",

    fuzzytags: query,

    // We want instrumental music because the video
    // already contains captions/narration-style content.
    vocalinstrumental: "instrumental",

    // We no longer require a minimum 30-second track.
    // FFmpeg will loop shorter music automatically.
    durationbetween: "15_600",

    order: "relevance",
  });

  const searchUrl =
    `${JAMENDO_API_URL}?${params.toString()}`;

  const response = await fetch(searchUrl);

  if (!response.ok) {
    throw new Error(
      `Jamendo API request failed with status ${response.status}`
    );
  }

  const data: JamendoResponse =
    await response.json();

  if (
    !data.results ||
    data.results.length === 0
  ) {
    return [];
  }

  // Only use tracks where downloading is explicitly allowed.
  return data.results.filter(
    (track) =>
      track.audiodownload_allowed &&
      typeof track.audiodownload === "string" &&
      track.audiodownload.length > 0
  );
}