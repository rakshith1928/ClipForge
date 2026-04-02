// frontend/app/upload/page.tsx
// This page handles file upload with drag-and-drop UI
// For now it's just the UI shell — no real upload logic yet (that's Phase 2)

"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// The 4 states our UI can be in
type Status = "idle" | "uploading" | "transcribing" | "done" | "error";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(20);
    setError("");

    try {
      // Build a FormData object — this is how you send files to a backend
      const formData = new FormData();
      formData.append("file", file);

      setProgress(40);
      setStatus("transcribing");

      // Send to our FastAPI backend
      const response = await fetch("http://localhost:8000/upload/", {
        method: "POST",
        body: formData,
        // Note: do NOT set Content-Type header manually with FormData
        // The browser sets it automatically with the correct boundary
      });

      setProgress(80);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed");
      }

      const data = await response.json();
      setProgress(100);
      setStatus("done");
      setTranscript(data.transcript);

      // Store in sessionStorage so the next page can use it
      // (Phase 3 will replace this with a proper database)
      sessionStorage.setItem("episode", JSON.stringify(data));

    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-xl">

        {/* Header */}
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Upload Episode</h1>
        <p className="text-zinc-400 mb-8">Supports MP4, MOV, MP3, WAV</p>

        {/* Show different UI depending on status */}
        {status === "idle" && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer
                ${isDragging ? "border-violet-500 bg-violet-500/10" : "border-zinc-700 hover:border-zinc-500"}`}
            >
              <input
                id="fileInput"
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="text-4xl mb-4">🎬</div>
              {file ? (
                <div>
                  <p className="font-semibold text-violet-400">{file.name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold mb-1">Drag &amp; drop your podcast here</p>
                  <p className="text-zinc-500 text-sm">or click to browse</p>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-6 space-y-4">
                <input
                  type="text"
                  placeholder="Episode title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleSubmit}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-4 rounded-xl transition-colors"
                >
                  Start Processing →
                </button>
              </div>
            )}
          </>
        )}

        {/* Processing state */}
        {(status === "uploading" || status === "transcribing") && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4 animate-bounce">
              {status === "uploading" ? "⬆️" : "🎙️"}
            </div>
            <p className="font-semibold mb-1">
              {status === "uploading" ? "Uploading file..." : "Transcribing with AI..."}
            </p>
            <p className="text-zinc-500 text-sm mb-6">
              {status === "transcribing" ? "This can take 1-3 minutes for long episodes" : ""}
            </p>
            {/* Progress bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-violet-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-zinc-500 text-xs mt-2">{progress}%</p>
          </div>
        )}

        {/* Done state */}
        {status === "done" && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
              <p className="text-green-400 font-semibold mb-1">✅ Transcription complete!</p>
              <p className="text-zinc-400 text-sm">{transcript.split(" ").length} words transcribed</p>
            </div>

            {/* Preview of transcript */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-3">Transcript Preview</p>
              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-6">{transcript}</p>
            </div>

            <button
              onClick={() => router.push("/analyze")}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-4 rounded-xl transition-colors"
            >
              Find Viral Clips &amp; Quotes →
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <p className="text-red-400 font-semibold mb-1">❌ Something went wrong</p>
            <p className="text-zinc-400 text-sm">{error}</p>
            <button
              onClick={() => { setStatus("idle"); setError(""); }}
              className="mt-4 text-violet-400 text-sm hover:underline"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}