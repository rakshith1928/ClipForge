"use client";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Loader2 } from "lucide-react";

type Status = "idle" | "uploading" | "transcribing" | "done" | "error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  // ── URL mode: Queue the job and poll for status ──────────────────────────────
  const handleUrlProcess = useCallback(async (url: string) => {
    setStatus("uploading");
    setProgress(0);
    setError("");
    try {
      // 1. Instantly get the ticket (job_id)
      const res = await fetch(`${API_BASE}/upload/url`, {
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
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/upload/status/${jobId}`);
          if (!statusRes.ok) return; // wait for next tick
          
          const statusData = await statusRes.json();
          setProgress(statusData.progress || 0);

          if (statusData.status === "done") {
            clearInterval(interval);
            setStatus("done");
            setTranscript(statusData.transcript);
            setFileId(statusData.file_id);
          } else if (statusData.status === "error") {
            clearInterval(interval);
            setStatus("error");
            setError(statusData.error || "Failed to process video.");
          } else {
            // queued, uploading, transcribing...
            setStatus(statusData.status as Status);
          }
        } catch (e) {
          // fetch error on polling, just ignore and retry next tick
        }
      }, 2000);

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
          const interval = setInterval(async () => {
            try {
              const statusRes = await fetch(`${API_BASE}/upload/status/${jobId}`);
              if (!statusRes.ok) return;
              
              const statusData = await statusRes.json();
              
              if (statusData.status === "done") {
                clearInterval(interval);
                setProgress(100);
                setStatus("done");
                setTranscript(statusData.transcript);
                setFileId(statusData.file_id);
              } else if (statusData.status === "error") {
                clearInterval(interval);
                setStatus("error");
                setError(statusData.error || "Failed to process video.");
              } else {
                setStatus(statusData.status as Status);
              }
            } catch (e) {
              // Ignore network hiccups during polling
            }
          }, 2000);

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
    xhr.open("POST", `${API_BASE}/upload/`);
    xhr.send(formData);
  };

  const isProcessing = status === "uploading" || status === "transcribing";

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen pb-20 bg-[#fff8f5] overflow-x-hidden selection:bg-[#ff6b35] selection:text-[#5f1900]">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
          
          .font-epilogue { font-family: 'Epilogue', sans-serif; }
          .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
          
          .glass-surface {
              background: rgba(255, 255, 255, 0.4);
              backdrop-filter: blur(24px);
              -webkit-backdrop-filter: blur(24px);
              border: 1px solid rgba(255, 255, 255, 0.6);
              box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.4);
          }
          .organic-wave {
              position: absolute;
              width: 100%;
              height: 400px;
              z-index: 0;
              opacity: 0.1;
              animation: slowFloat 20s ease-in-out infinite alternate;
          }
          @keyframes slowFloat {
              0% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(20px, 15px) scale(1.05); }
              100% { transform: translate(-10px, 30px) scale(1); }
          }
          .ambient-glow {
              box-shadow: 
                  0 4px 6px -1px rgba(255, 107, 53, 0.05), 
                  0 10px 15px -3px rgba(255, 107, 53, 0.08), 
                  0 20px 40px -4px rgba(255, 107, 53, 0.06);
          }
          @keyframes popUp {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
          }
          .animate-pop-up {
              opacity: 0;
              animation: popUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .scrollbar-hide::-webkit-scrollbar {
              display: none;
          }
          .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
          }
        `}</style>

        {/* Organic Background Waves */}
        <div className="organic-wave top-0 left-0 bg-gradient-to-br from-[#ff6b35]/30 to-transparent blur-[120px]"></div>
        <div className="organic-wave bottom-0 right-0 bg-gradient-to-tl from-[#fdd1b4]/30 to-transparent blur-[120px]" style={{ animationDelay: '-5s' }}></div>

        <div className="relative z-10 max-w-[800px] mx-auto px-6 pt-20 flex flex-col gap-6">

          {/* Header Section */}
          <header className="text-center mb-6 animate-pop-up" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-4xl md:text-[64px] leading-[1.1] font-bold text-[#261911] mb-3 font-epilogue tracking-tight">
              {prefilledUrl ? "Processing Video" : "Upload Your Episode"}
            </h1>
            <p className="text-lg text-[#594139] max-w-xl mx-auto font-jakarta">
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
                  className={`glass-surface p-12 rounded-[3rem] border-2 border-dashed text-center transition-all cursor-pointer group ambient-glow ${isDragging ? "border-[#ff6b35]" : "border-orange-500/10 hover:border-[#ff6b35]/60"
                    }`}
                >
                  <input
                    id="fileInput"
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="w-24 h-24 bg-[#ff6b35]/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[#ff6b35] text-5xl" style={{ fontVariationSettings: "'FILL' 0" }}>
                      {file ? "video_file" : "cloud_upload"}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#261911] mb-1 font-jakarta">
                    {file ? file.name : "Drag and drop your file"}
                  </h3>
                  <p className="text-sm text-[#594139] mb-6 font-jakarta">
                    {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB Ready` : "Supports MP4, MOV, and AVI up to 2GB"}
                  </p>
                  <button className="bg-[#ff6b35] text-[#5f1900] px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-orange-500/20 font-jakarta pointer-events-none">
                    {file ? "Change File" : "Select Video File"}
                  </button>
                </div>
              </section>

              {/* 2. Episode Title Box and Start Processing Button */}
              <section className="animate-pop-up" style={{ animationDelay: '0.3s' }}>
                <div className={`glass-surface p-6 rounded-[2rem] ambient-glow border-orange-500/10 transition-all duration-300 ${file ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                  <div className="mb-6">
                    <label className="block text-sm font-bold uppercase tracking-widest text-[#594139] mb-1 ml-1 font-jakarta">Episode Title</label>
                    <input
                      className="w-full bg-[#fff1eb] border border-[#e1bfb5]/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent outline-none text-[#261911] font-jakarta"
                      placeholder="e.g. The Future of Content Creation Ep. 42"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleFileSubmit}
                    disabled={!file}
                    className="w-full bg-[#ff6b35] text-[#5f1900] py-4 rounded-full font-bold text-lg hover:scale-[0.98] transition-transform shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 font-jakarta"
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
              <div className="glass-surface p-6 rounded-[2rem] space-y-6 border border-orange-500/10 ambient-glow">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-lg bg-[#ff6b35]/10 flex items-center justify-center text-[#ff6b35] shrink-0">
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>graphic_eq</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-[#261911] truncate font-jakarta">
                        {prefilledUrl ? prefilledUrl : (file?.name || "Processing...")}
                      </h4>
                      <span className="text-xs text-[#594139] font-jakarta">
                        {prefilledUrl ? "URL" : file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#ffeadf] rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff6b35] rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-[#ab3500] font-bold font-jakarta">
                        {status === "uploading" ? `Uploading (${progress}%)` : `Transcribing (${progress}%)`}
                      </span>
                      <span className="text-xs text-[#594139] font-jakarta">
                        {status === "transcribing" ? "Analyzing audio..." : "Processing request..."}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-orange-500/5 flex flex-col items-center text-center gap-3">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-[#ff6b35]/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-[#ff6b35] border-t-transparent animate-spin"></div>
                    <span className="material-symbols-outlined text-2xl text-[#ff6b35]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#261911] font-jakarta">
                      {status === "uploading" ? (prefilledUrl ? "Downloading Video..." : "Uploading Stream...") : "Transcribing with AI..."}
                    </h4>
                    <p className="text-xs text-[#594139] font-jakarta">
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
              <div className="glass-surface p-8 sm:p-12 rounded-[2rem] flex flex-col ambient-glow min-h-[500px]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <div className="flex items-center gap-1 text-emerald-600 font-bold mb-1">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span className="text-sm uppercase tracking-widest font-jakarta">Analysis Ready</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-bold text-[#261911] leading-tight font-epilogue">Viral Quotes & Highlights</h3>
                  </div>
                  <span className="px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-sm font-bold flex items-center gap-1 border border-orange-100 shrink-0 font-jakarta">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    AI Engine Active
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide max-h-[400px]">
                  <div className="p-4 bg-white/40 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-[#ab3500] px-2 py-1 bg-[#ab3500]/5 rounded">00:00</span>
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#594139] bg-[#fde3d6] px-2 py-1 rounded">Transcript Snippet</span>
                    </div>
                    <p className="text-[#261911] font-medium leading-relaxed italic group-hover:text-[#ab3500] transition-colors font-jakarta">
                      "{transcript.length > 250 ? transcript.slice(0, 250) + "..." : transcript}"
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => router.push(`/analyze/${fileId}`)}
                    className="w-full bg-[#ff6b35] text-[#5f1900] py-5 rounded-full font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 font-jakarta"
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
              <div className="glass-surface p-12 rounded-[3rem] text-center border border-red-500/20 ambient-glow">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-red-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                </div>
                <h3 className="text-2xl font-bold text-red-600 mb-2 font-epilogue">
                  {prefilledUrl ? "Download Failed" : "Upload Exception"}
                </h3>
                <p className="text-[#594139] text-sm mb-8 max-w-sm mx-auto p-4 bg-white/50 rounded-xl font-mono border border-red-100 font-jakarta">
                  {error}
                </p>
                <button
                  onClick={resetState}
                  className="bg-[#ff6b35] text-[#5f1900] px-8 py-3.5 rounded-full font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center mx-auto gap-2 font-jakarta hover:scale-105"
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
        <Loader2 className="w-8 h-8 text-[#ff6b35] animate-spin" />
      </main>
    }>
      <UploadPageInner />
    </Suspense>
  );
}