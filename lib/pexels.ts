// lib/pexels.ts

import fs from "fs";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";

interface PexelsPhoto {
  src: {
    landscape: string;
    large: string;
    original: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not set in the environment.");
  }

  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(
    query
  )}&orientation=landscape&per_page=5`;

  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    throw new Error(`Pexels API request failed with status ${res.status}`);
  }

  const data = (await res.json()) as PexelsSearchResponse;
  if (data.photos && data.photos.length > 0) {
    return data.photos[0];
  }
  return null;
}

/**
 * Try to simplify a query if the original returns no results, e.g.
 * "cinematic Ethiopian coffee plantation at sunrise" -> "coffee plantation".
 * This is a simple heuristic: strip common cinematic/style adjectives and
 * fall back to the last two significant words.
 */
function simplifyQuery(query: string): string {
  const stopWords = new Set([
    "cinematic",
    "dramatic",
    "beautiful",
    "aesthetic",
    "close-up",
    "closeup",
    "wide",
    "shot",
    "photo",
    "photograph",
    "image",
    "of",
    "at",
    "the",
    "a",
    "an",
    "sunrise",
    "sunset",
    "vintage",
    "moody",
  ]);

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => !stopWords.has(w));

  if (words.length === 0) return query;
  // Keep the last 2 significant words, which are usually the core subject.
  return words.slice(-2).join(" ");
}

/**
 * Search Pexels for an image matching the query and download it to
 * destPath. Falls back to a simplified query if the first search fails.
 * Returns true if an image was downloaded, false if no image could be found
 * (caller should skip the scene rather than throw).
 */
export async function downloadImageForQuery(
  query: string,
  destPath: string
): Promise<boolean> {
  let photo = await searchPexels(query);

  if (!photo) {
    const simplified = simplifyQuery(query);
    if (simplified !== query.toLowerCase()) {
      photo = await searchPexels(simplified);
    }
  }

  if (!photo) {
    return false;
  }

  const imageUrl = photo.src.landscape || photo.src.large || photo.src.original;
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    return false;
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return true;
}
