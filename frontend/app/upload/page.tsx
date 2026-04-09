"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

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

  const handleSubmit = () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(0);
    setError("");

    // Build a FormData object
    const formData = new FormData();
    formData.append("file", file);
    if (title.trim() !== "") {
      formData.append("title", title); // Fix: Append the title!
    }

    // Use XMLHttpRequest for actual progress tracking
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
        if (percentComplete === 100) {
          setStatus("transcribing");
        }
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setProgress(100);
          setStatus("done");
          setTranscript(data.transcript);

          // Store in sessionStorage so the next page can use it
          sessionStorage.setItem("episode", JSON.stringify(data));
        } catch (e) {
          setStatus("error");
          setError("Failed to parse response");
        }
      } else {
        setStatus("error");
        let errMessage = "Upload failed";
        try {
          const errorRes = JSON.parse(xhr.responseText);
          errMessage = errorRes.detail || errMessage;
        } catch(e) {}
        setError(errMessage);
      }
    });

    xhr.addEventListener("error", () => {
      setStatus("error");
      setError("Network error occurred during upload.");
    });

    xhr.open("POST", "http://localhost:8000/upload/");
    // Note: Do not set Content-Type to multipart/form-data manually, XHR does it with the boundary boundary automatically
    xhr.send(formData);
  };

  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col relative w-full overflow-x-hidden">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-32 relative z-10 w-full max-w-7xl mx-auto">
        <div className="w-full max-w-2xl">
  
          {/* Header */}
          <div className="mb-12 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-gradient mb-4">
              Upload Episode
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2 text-on-surface-variant font-body">
              <span className="material-symbols-outlined text-[20px]">audio_file</span>
              <p>Supports MP4, MOV, MP3, WAV</p>
            </div>
          </div>
  
          {/* Show different UI depending on status */}
          {status === "idle" && (
            <div className="flex flex-col gap-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
                className={`glass-card rounded-2xl p-16 text-center transition-all cursor-pointer border
                  ${isDragging ? "border-primary glow-shadow" : "border-outline-variant/15 hover:border-primary/50"}`}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-5xl">task</span>
                    <div>
                      <p className="font-semibold text-primary">{file.name}</p>
                      <p className="text-on-surface-variant text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-2">cloud_upload</span>
                    <h3 className="text-xl font-headline font-bold text-white mb-1">Drag & drop your podcast here</h3>
                    <p className="text-on-surface-variant text-sm font-body">or click to browse from your computer</p>
                  </div>
                )}
              </div>
  
              {file && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Episode title (optional)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant/15 rounded-xl px-4 py-4 text-white placeholder-on-surface-variant/50 focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(186,158,255,0.2)] transition-all font-body"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    className="w-full premium-gradient-bg text-on-primary-fixed font-bold py-4 rounded-full glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Start Processing <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </div>
              )}
            </div>
          )}
  
          {/* Processing state (Uploading/Transcribing) */}
          {(status === "uploading" || status === "transcribing") && (
            <div className="glass-card rounded-2xl p-12 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-full premium-gradient-bg mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(186,158,255,0.3)] mb-8">
                <span className={`material-symbols-outlined text-white text-4xl ${status === "uploading" ? "animate-bounce" : "animate-spin"}`}>
                  {status === "uploading" ? "cloud_upload" : "sync"}
                </span>
              </div>
              
              <h3 className="text-2xl font-headline font-bold text-white mb-2">
                {status === "uploading" ? "Uploading to Cloud..." : "Transcribing with AI..."}
              </h3>
              
              <p className="text-on-surface-variant font-body text-sm mb-10">
                {status === "uploading" ? "Encrypting and syncing your file securely." : "Atmospheric Intelligence is analyzing the audio. This takes 1-3 minutes."}
              </p>
              
              {/* Sleek Progress bar */}
              <div className="w-full max-w-sm mx-auto">
                <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-3 text-xs font-label tracking-widest uppercase text-primary">
                  <span>{status === "uploading" ? "Transferring" : "Processing"}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </div>
          )}
  
          {/* Done state */}
          {status === "done" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="glass-card !bg-[#0e2a14]/60 !border-[#176a21]/30 rounded-2xl p-8 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-[#176a21]/30 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[#90e28a] text-3xl">check_circle</span>
                </div>
                <div>
                  <h3 className="text-xl font-headline font-bold text-[#90e28a] mb-1">Upload Complete!</h3>
                  <p className="text-on-surface-variant font-body">Atmospheric Intelligence has extracted {transcript.split(" ").length} words.</p>
                </div>
              </div>
  
              {/* Preview of transcript */}
              <div className="glass-card rounded-2xl p-8 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-surface-container-high"></div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">terminal</span>
                  <p className="text-tertiary font-label text-xs tracking-widest uppercase">Transcription Output</p>
                </div>
                <p className="text-sm text-on-surface-variant font-body leading-relaxed line-clamp-6 pl-4 border-l border-outline-variant/20 relative z-10">
                  {transcript}
                </p>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-surface-container/90 to-transparent pointer-events-none z-20"></div>
              </div>
  
              <button
                onClick={() => router.push("/analyze")}
                className="w-full premium-gradient-bg text-on-primary-fixed font-bold py-5 rounded-full glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg mt-4"
              >
                Find Viral Clips & Quotes <span className="material-symbols-outlined">auto_awesome</span>
              </button>
            </div>
          )}
  
          {/* Error state */}
          {status === "error" && (
            <div className="glass-card !bg-[rgba(215,51,87,0.1)] !border-[#d73357]/30 rounded-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 rounded-full bg-[#d73357]/20 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-[#ffb2b9] text-3xl">error</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-[#ffb2b9] mb-2">Upload Interrupted</h3>
              <p className="text-[#ffb2b9]/80 font-body text-sm mb-8">{error}</p>
              
              <button
                onClick={() => { setStatus("idle"); setError(""); setProgress(0); }}
                className="px-8 py-3 rounded-full border border-[#ffb2b9]/30 text-[#ffb2b9] font-bold hover:bg-[#d73357]/10 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
  
        </div>
      </div>
      <Footer />
    </main>
  );
}