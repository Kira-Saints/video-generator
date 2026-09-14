# Automated Video Generator (MVP)

Enter a topic, get back an MP4 with images, background music, and burned-in captions.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env example and fill in your keys:

   ```bash
   cp .env.local.example .env.local
   ```

   ```env
   PEXELS_API_KEY=your_pexels_key
   GEMINI_API_KEY=your_gemini_key
   ```

   - Pexels: https://www.pexels.com/api/ (free)
   - Gemini: https://aistudio.google.com/apikey (free tier available)

3. **FFmpeg must be installed and on your PATH.**
   - macOS: `brew install ffmpeg`
   - Windows: download a build from https://www.gyan.dev/ffmpeg/builds/ and add its `bin` folder to PATH
   - Linux: `sudo apt install ffmpeg`

   Verify with `ffmpeg -version`.

4. **Replace the placeholder background music.** `public/music/background.mp3`
   currently contains a generated placeholder tone so the app runs out of the
   box. Swap in a real royalty-free/royalty-cleared MP3 before using this for
   anything real.

5. Run it:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, enter a topic, click Generate Video.

## How it works

```
Topic
 -> Gemini generates a short script + 5-6 scenes (caption + image query each)
 -> Pexels is searched for one image per scene (falls back to a simplified
    query, or skips the scene, if no image is found)
 -> FFmpeg turns each image into a ~5s clip with a slow zoom in/out
 -> Clips are concatenated
 -> An SRT file is generated from the scene captions
 -> Background music (public/music/background.mp3) is looped/trimmed in
 -> Captions are burned into the video
 -> final.mp4 is served from /api/videos/[jobId]
```

Temp files live in `os.tmpdir()/video-generator/<jobId>/` and everything
except `final.mp4` is deleted once generation succeeds.

## Project structure

```
app/
  page.tsx                       - the single-page UI
  api/generate-video/route.ts    - POST, runs the full pipeline
  api/videos/[jobId]/route.ts    - GET, streams the final MP4
lib/
  ai.ts                          - Gemini script/scene generation
  pexels.ts                      - Pexels search + image download
  ffmpeg.ts                      - all ffmpeg operations (scenes, concat, music, captions)
  captions.ts                    - SRT generation
  video-generator.ts             - orchestrates the whole pipeline
public/music/background.mp3      - local background track (replace this)
```

## Notes / known limitations (intentional, per MVP scope)

- No database, auth, queues, or cloud storage — a single Node process runs
  the pipeline synchronously per request and writes to the OS temp dir.
- Progress in the UI is a simple timed fake-progress indicator, not real
  step-by-step reporting from the server.
- If Gemini or Pexels quota/keys are missing or fail, the API returns a
  plain user-facing error message; details are logged server-side only.
