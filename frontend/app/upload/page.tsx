"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  CloudUpload, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  Terminal, 
  AlertCircle, 
  ArrowRight,
  Sparkles
} from "lucide-react";

type Status = "idle" | "uploading" | "transcribing" | "done" | "error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [fileId, setFileId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const resetState = () => {
    setStatus("idle");
    setError("");
    setProgress(0);
    setFile(null); // Fix: Explicitly flush ghost state
    setTitle("");
    setFileId("");
  };

  const handleSubmit = () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim() !== "") {
      formData.append("title", title);
    }

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
          setFileId(data.file_id);
        } catch (e) {
          setStatus("error");
          setError("Failed to parse AI response. Please try again.");
        }
      } else {
        setStatus("error");
        let errMessage = "Upload failed during processing.";
        try {
          const errorRes = JSON.parse(xhr.responseText);
          errMessage = errorRes.detail || errMessage;
        } catch(e) {}
        setError(errMessage);
      }
    });

    xhr.addEventListener("error", () => {
      setStatus("error");
      setError("Network or server connection dropped.");
    });

    // Fix: Secure environment-based URL
    xhr.open("POST", `${API_BASE}/upload/`);
    xhr.send(formData);
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-[#e5e1e4] font-sans selection:bg-[#7c3aed]/30 flex flex-col relative w-full overflow-x-hidden p-6">
      
      <div className="flex-1 flex flex-col justify-center items-center relative z-10 w-full max-w-2xl mx-auto py-12">
        
        {/* Editorial Header */}
        <div className="w-full text-center sm:text-left mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Ignite Intelligence.
          </h1>
          <p className="text-[#a1a1aa] text-sm sm:text-base max-w-md mx-auto sm:mx-0">
            Upload your raw podcast audio or video. We'll extract the transcript, decode the context, and isolate viral moments automatically.
          </p>
        </div>

        {/* 1. Idle State: Drag & Drop */}
        {status === "idle" && (
          <div className="w-full space-y-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
              className={`w-full bg-[#18181b] rounded-2xl p-12 sm:p-20 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed
                ${isDragging 
                  ? "border-[#7c3aed] shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)] scale-[1.02]" 
                  : "border-[#27272a] hover:border-[#4a4455] hover:bg-[#1b1b1f]"}`}
            >
              <input
                id="fileInput"
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              
              {file ? (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-[#7c3aed]/20 rounded-full flex items-center justify-center">
                    <FileAudio className="text-[#d2bbff] w-8 h-8" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-lg">{file.name}</p>
                    <p className="text-[#7c3aed] text-sm font-medium mt-1 uppercase tracking-wider">
                      {(file.size / 1024 / 1024).toFixed(1)} MB Ready
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <CloudUpload className={`w-12 h-12 transition-colors ${isDragging ? "text-[#7c3aed]" : "text-[#a1a1aa]"}`} strokeWidth={1.5} />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Upload Pipeline</h3>
                    <p className="text-[#a1a1aa] text-sm">Drag and drop, or tap to browse MP3, WAV, or MP4.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Inputs & CTA */}
            <div className={`space-y-4 transition-all duration-500 origin-top ${file ? 'opacity-100 scale-100' : 'opacity-50 scale-95 pointer-events-none'}`}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Episode Title (Optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0e0e10] border border-[#27272a] rounded-xl px-5 py-4 text-white text-sm focus:outline-none focus:border-[#7c3aed] transition-colors shadow-inner"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!file}
                className="w-full bg-gradient-to-r from-[#7c3aed] to-[#d2bbff] hover:opacity-90 disabled:opacity-50 text-[#25005a] font-extrabold py-4 rounded-xl transition-all shadow-[0_4px_20px_-5px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 text-lg"
              >
                Launch Sequence <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* 2. Processing State */}
        {(status === "uploading" || status === "transcribing") && (
          <div className="w-full bg-[#18181b] border border-[#27272a] rounded-2xl p-12 sm:p-20 text-center animate-in fade-in zoom-in-95 duration-500 shadow-2xl">
            <div className="w-24 h-24 mx-auto relative mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[#27272a]"></div>
              <svg className="absolute inset-0 w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-[#7c3aed] transition-all duration-300 ease-out"
                  strokeDasharray="289"
                  strokeDashoffset={289 - (289 * progress) / 100}
                />
              </svg>
              <Loader2 className={`w-8 h-8 text-[#d2bbff] ${status === "transcribing" ? "animate-spin" : "animate-pulse"}`} />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">
              {status === "uploading" ? "Uploading Stream..." : "Deep-Learning Transcription..."}
            </h3>
            <p className="text-[#a1a1aa] text-sm mb-10 max-w-xs mx-auto">
              {status === "uploading" 
                ? "Securely transferring packet data to the ingestion module." 
                : "Nova-2 models are parsing the audio topology. This takes 1-3 minutes."}
            </p>
            
            <div className="w-full max-w-xs mx-auto bg-[#0e0e10] border border-[#27272a] rounded-full px-4 py-2 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-[#7c3aed]">
              <span>STATUS</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {/* 3. Success State */}
        {status === "done" && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-2xl p-6 sm:p-8 flex items-center gap-5 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="text-[#10b981] w-7 h-7" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#10b981] mb-1">Ingestion Complete</h3>
                <p className="text-[#a1a1aa] text-sm md:text-base">
                  Isolated exactly <span className="font-mono text-[#d2bbff] bg-[#27272a] px-1.5 py-0.5 rounded">{transcript.split(" ").length}</span> words from the audio file.
                </p>
              </div>
            </div>

            {/* Frosted Terminal Snapshot */}
            <div className="bg-[#0e0e10] border border-[#27272a] rounded-2xl p-6 sm:p-8 relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#7c3aed] to-[#27272a]"></div>
              <div className="flex items-center gap-3 mb-5 border-b border-[#27272a] pb-4">
                <Terminal className="text-[#7c3aed] w-5 h-5" strokeWidth={2} />
                <p className="text-[#a1a1aa] text-xs font-bold uppercase tracking-widest">stdout // Raw JSON Extract</p>
              </div>
              <p className="font-mono text-sm text-[#e5e1e4] leading-relaxed line-clamp-6 opacity-80 group-hover:opacity-100 transition-opacity">
                "{transcript}"
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0e0e10] to-transparent pointer-events-none"></div>
            </div>

            <button
              onClick={() => router.push(`/analyze/${fileId}`)}
              className="w-full bg-[#18181b] hover:bg-[#7c3aed] border border-[#27272a] hover:border-[#7c3aed] text-white flex items-center justify-center gap-3 font-bold py-5 rounded-2xl transition-all duration-300 shadow-xl group"
            >
              Analyze Viral Intelligence <Sparkles className="w-5 h-5 text-[#d2bbff] group-hover:text-white transition-colors" />
            </button>
          </div>
        )}

        {/* 4. Error State */}
        {status === "error" && (
          <div className="w-full bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-2xl p-12 text-center animate-in fade-in zoom-in-95 duration-500 backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-6 border border-[#ef4444]/20">
              <AlertCircle className="text-[#ef4444] w-10 h-10" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#ef4444] mb-2">Upload Fatal Exception</h3>
            <p className="text-[#a1a1aa] text-sm mb-10 max-w-sm mx-auto p-4 bg-[#0e0e10] rounded-xl font-mono border border-[#27272a]">
              {error}
            </p>
            
            <button
              onClick={resetState}
              className="bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-white px-8 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center w-full sm:w-auto mx-auto gap-2"
            >
              Flush Cache & Try Again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}