# Automated Video Generator (MVP)

A simple automated video generator built with **Next.js, Gemini, Pexels, Jamendo, and FFmpeg**.

Enter a topic and the application automatically generates a short MP4 video containing:

* AI-generated script and scene captions
* Relevant images from Pexels
* Automatically selected instrumental background music from Jamendo
* Simple Ken Burns zoom effects
* Hardcoded captions
* 16:9 HD video output at 1280x720

The generated video is approximately 30 seconds long.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_key
PEXELS_API_KEY=your_pexels_key
JAMENDO_CLIENT_ID=your_jamendo_client_id
```

API keys:

* Gemini: [Google AI Studio](https://aistudio.google.com/apikey?utm_source=chatgpt.com)
* Pexels: [Pexels API](https://www.pexels.com/api/?utm_source=chatgpt.com)
* Jamendo: [Jamendo Developer API](https://developer.jamendo.com/v3.0?utm_source=chatgpt.com)

**Do not commit `.env.local` to GitHub.** The `.gitignore` file already excludes environment files.

### 3. Install FFmpeg

**FFmpeg must be installed and available in your system PATH.**

#### Windows

Download an FFmpeg build from:

[FFmpeg Builds by gyan.dev](https://www.gyan.dev/ffmpeg/builds/?utm_source=chatgpt.com)

Add the FFmpeg `bin` folder to your system PATH.

#### macOS

```bash
brew install ffmpeg
```

#### Linux

```bash
sudo apt install ffmpeg
```

Verify the installation:

```bash
ffmpeg -version
```

### 4. Run the application

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Enter a topic and click **Generate Video**.

## How It Works

```text
User enters a topic
        |
        v
Gemini generates:
- Short script
- 5-6 scene captions
- Image search queries
- Music search query
        |
        v
Pexels searches for relevant images
        |
        v
Each image becomes a ~5 second
video scene with a slow zoom effect
        |
        v
Scenes are concatenated
        |
        v
Jamendo searches for suitable
instrumental background music
        |
        v
Background music is downloaded,
looped, and trimmed to the video length
        |
        v
SRT captions are generated
        |
        v
Captions are burned into the video
        |
        v
Final MP4 video
```

## Video Specifications

| Property         | Value                       |
| ---------------- | --------------------------- |
| Format           | MP4                         |
| Resolution       | 1280x720                    |
| Aspect Ratio     | 16:9                        |
| Frame Rate       | 30 FPS                      |
| Video Codec      | H.264                       |
| Scenes           | 5-6                         |
| Scene Duration   | ~5 seconds                  |
| Total Duration   | ~30 seconds                 |
| Captions         | Hardcoded                   |
| Background Music | Jamendo instrumental tracks |

## Background Music

Background music is selected automatically based on the topic.

Gemini generates a short music search query such as:

```text
cheerful acoustic folk
```

The application searches Jamendo using progressively broader queries if the original search does not return a suitable track.

For example:

```text
cheerful acoustic folk
        ↓
cheerful acoustic
        ↓
cheerful
        ↓
instrumental
```

Only tracks that allow downloading are considered.

The selected track is downloaded temporarily and used as the video's background music. It is not stored permanently in the project.

> **Licensing note:** Check the applicable Jamendo license and usage terms before using generated videos commercially.

## Image Handling

Gemini generates a simple image search query for each scene.

For example:

```text
Topic: How coffee is made

Scene image query:
coffee beans
coffee roasting
coffee machine
coffee cup
```

Pexels is then searched for each query.

If an image cannot be found, the application attempts to use the available scenes rather than immediately failing the entire video generation process.

## Temporary Files

Each video generation job receives its own temporary directory:

```text
os.tmpdir()/video-generator/<jobId>/
```

During generation, the directory may contain:

```text
image-01.jpg
image-02.jpg
scene-01.mp4
scene-02.mp4
concat-list.txt
concatenated.mp4
captions.srt
background.mp3
with-music.mp4
final.mp4
```

After successful generation, all intermediate files are deleted and only:

```text
final.mp4
```

is kept.

If video generation fails, the entire temporary job directory is removed.

## Project Structure

```text
app/
├── page.tsx
│   └── Single-page user interface
│
└── api/
    ├── generate-video/
    │   └── route.ts
    │       └── Starts the video generation process
    │
    └── videos/
        └── [jobId]/
            └── route.ts
                └── Streams the generated MP4

lib/
├── ai.ts
│   └── Gemini script, scene, and music query generation
│
├── pexels.ts
│   └── Pexels image search and image downloading
│
├── music.ts
│   └── Jamendo music search and downloading
│
├── ffmpeg.ts
│   └── FFmpeg scene creation, concatenation,
│       music processing, and caption burning
│
├── captions.ts
│   └── SRT caption generation
│
└── video-generator.ts
    └── Main video generation pipeline

public/
└── ...
```

## Main Technologies

* **Next.js** - Web application framework
* **React** - User interface
* **TypeScript** - Application development
* **Gemini** - AI script, scene, image query, and music query generation
* **Pexels API** - Stock image search
* **Jamendo API** - Instrumental background music
* **FFmpeg** - Video processing and assembly

## Current Limitations

This is intentionally a simple MVP.

* No database
* No authentication
* No job queue
* No Redis
* No cloud storage
* No video editor or timeline
* No voiceover or text-to-speech
* No AI-generated video
* No real-time server-side progress reporting
* Video generation runs synchronously in the Node.js process
* Temporary files are stored in the operating system's temporary directory
* External API availability and quotas can affect video generation
* Jamendo music licensing must be checked before commercial use

## Error Handling

If Gemini, Pexels, Jamendo, or FFmpeg fails, the application returns a user-friendly error message while detailed technical errors are logged on the server.

The application also attempts to recover from some external API issues, such as broadening Jamendo music searches when an exact music query does not return results.

## Future Improvements

Possible future improvements include:

* Better video transitions
* More advanced image selection
* Multiple music tracks
* Voiceover generation
* Real-time generation progress
* Background job processing
* Cloud storage
* User accounts
* Video history
* Additional video formats such as 9:16 for Shorts/Reels/TikTok
