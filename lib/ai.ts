// lib/ai.ts

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface Scene {
  text: string;
  image_query: string;
}

export interface VideoScript {
  title: string;
  script: string;
  music_query: string;
  scenes: Scene[];
}

const PROMPT_TEMPLATE = (topic: string) => `
You are writing a short ~30 second narrated video script about the topic:
"${topic}"

Return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:

{
  "title": "string",
  "script": "string (the full short script, 4-6 sentences)",
  "music_query": "string (2-4 word search query for suitable instrumental background music)",
  "scenes": [
    { "text": "string (short caption, one sentence)", "image_query": "string (2-4 word image search query)" }
  ]
}

Rules:
- Generate 5 to 6 scenes total.
- Each scene's "text" should be a short, single sentence caption (under 15 words).
- Each scene's "image_query" should be a simple, concrete, visually searchable phrase (2-4 words), suitable for a stock photo search.
- Do not use abstract or stylistic words in image_query.
- The "music_query" should describe the mood, style, or genre of instrumental background music that fits the topic.
- The "music_query" must contain only 2-4 simple searchable words.
- Prefer general music terms such as:
  - acoustic
  - upbeat
  - relaxing
  - cinematic
  - inspiring
  - electronic
  - ambient
  - dramatic
  - cheerful
  - calm
  - energetic
  - mysterious
  - uplifting
  - documentary
- Do not request vocals or lyrics.
- The music should be suitable as quiet background music underneath narration.
- Generate music_query based on the overall topic and mood of the video.
- Do not include any text outside the JSON object.
`;

/**
 * Call Gemini to generate the script + scenes + music query for a topic.
 */
export async function generateVideoScript(topic: string): Promise<VideoScript> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the environment.");
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: PROMPT_TEMPLATE(topic) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", res.status, errText);
    throw new Error(`Gemini API request failed with status ${res.status}`);
  }

  const data = await res.json();

  const rawText: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    console.error("Gemini API returned no text:", JSON.stringify(data));
    throw new Error("Gemini API returned an empty response.");
  }

  // Defensive cleanup in case the model wraps the JSON in a code fence
  // despite instructions not to.
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: VideoScript;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Gemini JSON:", cleaned);
    throw new Error("Gemini API returned malformed JSON.");
  }

  if (
    !parsed.scenes ||
    !Array.isArray(parsed.scenes) ||
    parsed.scenes.length === 0
  ) {
    throw new Error("Gemini API response did not include any scenes.");
  }

  if (
    !parsed.music_query ||
    typeof parsed.music_query !== "string" ||
    parsed.music_query.trim().length === 0
  ) {
    throw new Error("Gemini API response did not include a music query.");
  }

  return parsed;
}