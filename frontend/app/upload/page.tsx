// frontend/app/upload/page.tsx
// This page handles file upload with drag-and-drop UI
// For now it's just the UI shell — no real upload logic yet (that's Phase 2)

"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type.startsWith("video/") || dropped.type.startsWith("audio/"))) {
      setFile(dropped);
    } else {
      alert("Please upload a video or audio file.");
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Upload Episode</h1>
        <p className="text-zinc-400 mb-8">Supports MP4, MOV, MP3, WAV — up to 2GB</p>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer
            ${isDragging ? "border-violet-500 bg-violet-500/10" : "border-zinc-700 hover:border-zinc-500"}`}
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <input
            id="fileInput"
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="text-4xl mb-4">🎬</div>
          {file ? (
            <div>
              <p className="font-semibold text-violet-400">{file.name}</p>
              <p className="text-zinc-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold mb-1">Drag & drop your podcast here</p>
              <p className="text-zinc-500 text-sm">or click to browse</p>
            </div>
          )}
        </div>

        {/* Episode title input */}
        {file && (
          <div className="mt-6 space-y-4">
            <input
              type="text"
              placeholder="Episode title (optional)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <button
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-4 rounded-xl transition-colors"
              onClick={() => alert("Phase 2 will wire this up!")}
            >
              Start Processing →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}