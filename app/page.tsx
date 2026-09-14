// app/page.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Status = "idle" | "loading" | "done" | "error";

const PROGRESS_STEPS = [
  "Creating script",
  "Finding images",
  "Creating video",
  "Adding music",
  "Adding captions",
];

// We don't have real progress from the server (the pipeline runs as a
// single request), so we advance a simple fake step indicator over time
// while the request is in flight. This is intentionally simple per the
// MVP scope.
const STEP_INTERVAL_MS = 3500;

export default function Home() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  async function handleGenerate() {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setStatus("error");
      setErrorMessage("Please enter a topic.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setVideoUrl(null);
    setCurrentStep(0);

    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, STEP_INTERVAL_MS);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmedTopic }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to generate the video.");
      }

      setVideoUrl(data.videoUrl);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to generate the video."
      );
    } finally {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Automated Video Generator</h1>

        <div className={styles.field}>
          <label htmlFor="topic">Topic</label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The History of Coffee"
            disabled={status === "loading"}
          />
        </div>

        <button
          className={styles.button}
          onClick={handleGenerate}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Generating..." : "Generate Video"}
        </button>

        {status === "error" && (
          <p className={styles.error}>{errorMessage}</p>
        )}

        {status === "loading" && (
          <div className={styles.progress}>
            <p>Generating video...</p>
            <ul>
              {PROGRESS_STEPS.map((step, index) => (
                <li key={step}>
                  <span>
                    {index < currentStep
                      ? "✓"
                      : index === currentStep
                      ? "●"
                      : "○"}
                  </span>{" "}
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {status === "done" && videoUrl && (
          <div className={styles.result}>
            <p>Your video is ready!</p>
            <video src={videoUrl} controls width="100%" />
            <a href={videoUrl} download={`${topic.trim() || "video"}.mp4`}>
              <button className={styles.button}>Download MP4</button>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
