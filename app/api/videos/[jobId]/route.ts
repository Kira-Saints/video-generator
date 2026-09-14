// app/api/videos/[jobId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { Readable } from "stream";
import { getFinalVideoPath } from "@/lib/video-generator";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Basic sanity check to avoid path traversal via the jobId param.
  if (!/^[a-zA-Z0-9-]+$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid video id." }, { status: 400 });
  }

  const videoPath = getFinalVideoPath(jobId);

  if (!fs.existsSync(videoPath)) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const stat = fs.statSync(videoPath);
  const nodeStream = fs.createReadStream(videoPath);
  const webStream = Readable.toWeb(
    nodeStream
  ) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${jobId}.mp4"`,
      "Cache-Control": "no-store",
    },
  });
}
