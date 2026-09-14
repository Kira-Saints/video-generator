// app/api/generate-video/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateVideo, VideoGenerationError } from "@/lib/video-generator";

export async function POST(req: NextRequest) {
  let body: { topic?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Please enter a topic." },
      { status: 400 }
    );
  }

  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json(
      { success: false, error: "Please enter a topic." },
      { status: 400 }
    );
  }

  try {
    const jobId = await generateVideo(topic);
    return NextResponse.json({
      success: true,
      videoUrl: `/api/videos/${jobId}`,
    });
  } catch (err) {
    // Never leak internal error details or API keys to the client.
    const message =
      err instanceof VideoGenerationError
        ? err.publicMessage
        : "Unable to generate the video.";
    console.error("generate-video failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
