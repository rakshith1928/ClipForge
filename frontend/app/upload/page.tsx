"use client";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Loader2 } from "lucide-react";
import { pollJobStatus } from "../../lib/pollJobStatus";
import { API_BASE, apiFetch, authHeaders } from "../../lib/api";

type Status = "idle" | "uploading" | "transcribing" | "done" | "error";

function UploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledUrl = searchParams.get("url") || "";

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [fileId, setFileId] = useState("");
  const [error, setError] = useState("");

  const hasFetched = useRef(false);
  const cancelPollingRef = useRef<(() => void) | null>(null);

  // B6: never leak polling intervals across navigation
  useEffect(() => {
    return () => cancelPollingRef.current?.();
  }, []);

  // ── Trigger AI analysis once the episode is transcribed ───────────────────
  const analysisTriggered = useRef(false);

  const triggerAnalysis = async (fid: string) => {
    if (analysisTriggered.current) return;
    analysisTriggered.current = true;
    try {
      await apiFetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fid }),
      });
    } catch (e) {
      console.error("Failed to trigger analysis", e);
    }
  };

  // ── URL mode: Queue the job and poll for status ──────────────────────────────
  const handleUrlProcess = useCallback(async (url: string) => {
    setStatus("uploading");
    setProgress(0);
    setError("");
    try {
      // 1. Instantly get the ticket (job_id)
      const res = await apiFetch(`${API_BASE}/upload/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title: "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error." }));
        throw new Error(err.detail || "Server error.");
      }
      const data = await res.json();
      const jobId = data.job_id;

      // 2. Poll the status endpoint every 2 seconds
      cancelPollingRef.current = pollJobStatus(API_BASE, jobId, (s) => {
        setProgress(s.progress || 0);
        if (s.status === "done") {
          setStatus("done");
          setTranscript(s.transcript || "");
          if (s.file_id) {
            setFileId(s.file_id);
            triggerAnalysis(s.file_id);
          }
        } else if (s.status === "error") {
          setStatus("error");
          setError(s.error || "Failed to process video.");
        } else {
          setStatus(s.status as Status);
        }
      });

    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }, []);

  // If URL param present → kick off immediately on mount (Protected by useRef!)
  useEffect(() => {
    if (prefilledUrl && !hasFetched.current) {
      hasFetched.current = true;
      handleUrlProcess(prefilledUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetState = () => {
    setStatus("idle");
    setError("");
    setProgress(0);
    setFile(null);
    setTitle("");
    setFileId("");
  };

  // ── File upload flow (unchanged XHR with real progress) ────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleFileSubmit = () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim()) formData.append("title", title);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setProgress(pct);
        if (pct === 100) setStatus("transcribing");
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const jobId = data.job_id;

          // The upload is finished, now start polling the background task
          cancelPollingRef.current = pollJobStatus(API_BASE, jobId, (s) => {
            if (s.status === "done") {
              setProgress(100);
              setStatus("done");
              setTranscript(s.transcript || "");
              if (s.file_id) {
                setFileId(s.file_id);
                triggerAnalysis(s.file_id);
              }
            } else if (s.status === "error") {
              setStatus("error");
              setError(s.error || "Failed to process video.");
            } else {
              setStatus(s.status as Status);
            }
          });

        } catch {
          setStatus("error");
          setError("Failed to parse server response.");
        }
      } else {
        setStatus("error");
        try { setError(JSON.parse(xhr.responseText).detail || "Upload failed."); }
        catch { setError("Upload failed during processing."); }
      }
    });
    xhr.addEventListener("error", () => {
      setStatus("error");
      setError("Network or server connection dropped.");
    });
    const token = authHeaders().Authorization;
    if (token) xhr.setRequestHeader("Authorization", token);
    xhr.open("POST", `${API_BASE}/upload/`);
    xhr.send(formData);
  };

  const isProcessing = status === "uploading" || status === "transcribing";

  return (
    <ProtectedRoute>
      <main className="min-h-screen pb-20 bg-stone-50">
        <style>{`
          @keyframes popUp {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
          }
          .animate-pop-up {
              opacity: 0;
              animation: popUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-pop-up { animation: none; opacity: 1; }
          }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        <div className="relative z-10 max-w-[800px] mx-auto px-6 pt-20 flex flex-col gap-6">

          {/* Header Section */}
          <header className="text-center mb-6 animate-pop-up" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-900 mb-3">
              {prefilledUrl ? "Processing Video" : "Upload Your Episode"}
            </h1>
            <p className="text-stone-600 max-w-xl mx-auto">
              {prefilledUrl
                ? "Downloading and transcribing your video — sit tight while we extract the viral moments."
                : "Transform your long-form content into viral clips with AI-powered analysis."}
            </p>
          </header>

          {/* IDLE */}
          {status === "idle" && !prefilledUrl && (
            <>
              {/* 1. Drag and Drop Zone */}
              <section className="animate-pop-up" style={{ animationDelay: '0.2s' }}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("fileInput")?.click()}
                  className={`bg-white border border-stone-100 shadow-sm p-12 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer group ${isDragging ? "border-primary-container" : "border-orange-500/10 hover:border-primary-container/60"
                    }`}
                >
                  <input
                    id="fileInput"
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="w-24 h-24 bg-primary-container/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-primary-container text-5xl" style={{ fontVariationSettings: "'FILL' 0" }}>
                      {file ? "video_file" : "cloud_upload"}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#261911] mb-1">
                    {file ? file.name : "Drag and drop your file"}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-6">
                    {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB Ready` : "Supports MP4, MOV, and AVI up to 2GB"}
                  </p>
                  <button className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-orange-500/20 pointer-events-none">
                    {file ? "Change File" : "Select Video File"}
                  </button>
                </div>
              </section>

              {/* 2. Episode Title Box and Start Processing Button */}
              <section className="animate-pop-up" style={{ animationDelay: '0.3s' }}>
                <div className={`bg-white border border-stone-100 shadow-sm p-6 rounded-[2rem] border-orange-500/10 transition-all duration-300 ${file ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                  <div className="mb-6">
                    <label className="block text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">Episode Title</label>
                    <input
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-container focus:border-transparent outline-none text-[#261911]"
                      placeholder="e.g. The Future of Content Creation Ep. 42"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleFileSubmit}
                    disabled={!file}
                    className="w-full bg-primary-container text-on-primary-container py-4 rounded-full font-bold text-lg hover:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    Start Processing
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* PROCESSING */}
          {isProcessing && (
            <section className="animate-pop-up" style={{ animationDelay: '0.4s' }}>
              <div className="bg-white border border-stone-100 shadow-sm p-6 rounded-[2rem] space-y-6 border border-orange-500/10">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container shrink-0">
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>graphic_eq</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-[#261911] truncate">
                        {prefilledUrl ? prefilledUrl : (file?.name || "Processing...")}
                      </h4>
                      <span className="text-xs text-on-surface-variant">
                        {prefilledUrl ? "URL" : file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-[#ab3500] font-bold">
                        {status === "uploading" ? `Uploading (${progress}%)` : `Transcribing (${progress}%)`}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {status === "transcribing" ? "Analyzing audio..." : "Processing request..."}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-orange-500/5 flex flex-col items-center text-center gap-3">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-primary-container/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary-container border-t-transparent animate-spin"></div>
                    <span className="material-symbols-outlined text-2xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#261911]">
                      {status === "uploading" ? (prefilledUrl ? "Downloading Video..." : "Uploading Stream...") : "Transcribing with AI..."}
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      {status === "transcribing" ? "Analyzing acoustic hooks & speaker patterns" : "Securely transferring data..."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SUCCESS */}
          {status === "done" && (
            <section className="animate-pop-up" style={{ animationDelay: '0.5s' }}>
              <div className="bg-white border border-stone-100 shadow-sm p-8 sm:p-12 rounded-[2rem] flex flex-col min-h-[500px]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-600 font-bold mb-1">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span className="text-sm uppercase tracking-widest">Analysis Ready</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-bold text-[#261911] leading-tight">Viral Quotes & Highlights</h3>
                  </div>
                  <span className="px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-sm font-bold flex items-center gap-1 border border-orange-100 shrink-0">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    AI Engine Active
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide max-h-[400px]">
                  <div className="p-4 bg-white/40 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-[#ab3500] px-2 py-1 bg-[#ab3500]/5 rounded">00:00</span>
                      <span className="text-[10px] uppercase font-black tracking-widest text-on-surface-container bg-surface-container-high px-2 py-1 rounded">Transcript Snippet</span>
                    </div>
                    <p className="text-[#261911] font-medium leading-relaxed italic group-hover:text-[#ab3500] transition-colors">
                      "{transcript.length > 250 ? transcript.slice(0, 250) + "..." : transcript}"
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => router.push(`/analyze/${fileId}`)}
                    className="w-full bg-primary-container text-on-primary-container py-5 rounded-full font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2"
                  >
                    Find Viral Clips & Quotes
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ERROR */}
          {status === "error" && (
            <section className="animate-pop-up" style={{ animationDelay: '0.1s' }}>
              <div className="bg-white border border-stone-100 shadow-sm p-12 rounded-xl text-center border border-red-500/20">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-red-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                </div>
                <h3 className="text-2xl font-bold text-red-600 mb-2">
                  {prefilledUrl ? "Download Failed" : "Upload Exception"}
                </h3>
                <p className="text-on-surface-container text-sm mb-8 max-w-sm mx-auto p-4 bg-white/50 rounded-xl font-mono border border-red-100">
                  {error}
                </p>
                <button
                  onClick={resetState}
                  className="bg-primary-container text-on-primary-container px-8 py-3.5 rounded-full font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center mx-auto gap-2 hover:scale-105"
                >
                  {prefilledUrl ? "Go Back" : "Try Again"}
                </button>
              </div>
            </section>
          )}

        </div>
      </main>
    </ProtectedRoute>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fff8f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-container animate-spin" />
      </main>
    }>
      <UploadPageInner />
    </Suspense>
  );
}