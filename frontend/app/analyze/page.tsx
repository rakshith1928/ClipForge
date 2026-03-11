// frontend/app/analyze/page.tsx
// This page reads the transcript from sessionStorage (saved in Phase 2),
// sends it to our /analyze endpoint, and shows quotes + clips the user can select.

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Quote = {
  text: string;
  speaker: string;
  theme: string;
  why_viral: string;
  start_time: number;
  end_time: number;
};

type Clip = {
  title: string;
  summary: string;
  why_viral: string;
  clip_type: string;
  start_time: number;
  end_time: number;
};

// Format seconds into mm:ss for display
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CLIP_TYPE_COLORS: Record<string, string> = {
  story: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  insight: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  debate: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  revelation: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  funny: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function AnalyzePage() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [summary, setSummary] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<number>>(new Set());
  const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"quotes" | "clips">("quotes");
  const router = useRouter();

  useEffect(() => {
    // Load episode data saved in Phase 2
    const raw = sessionStorage.getItem("episode");
    if (!raw) {
      setError("No episode data found. Please upload first.");
      setStatus("error");
      return;
    }

    const episode = JSON.parse(raw);
    runAnalysis(episode);
  }, []);

  const runAnalysis = async (episode: any) => {
    try {
      const response = await fetch("http://localhost:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: episode.transcript,
          words: episode.words,
          episode_title: episode.title || "",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data = await response.json();
      setQuotes(data.quotes);
      setClips(data.clips);
      setSummary(data.episode_summary);
      setThemes(data.main_themes);
      setStatus("done");

      // Save analysis results for Phase 4
      sessionStorage.setItem("analysis", JSON.stringify(data));

    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  const toggleQuote = (i: number) => {
    setSelectedQuotes(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleClip = (i: number) => {
    setSelectedClips(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleGenerate = () => {
    // Save which quotes and clips the user selected
    const selected = {
      quotes: [...selectedQuotes].map(i => quotes[i]),
      clips: [...selectedClips].map(i => clips[i]),
    };
    sessionStorage.setItem("selected", JSON.stringify(selected));
    router.push("/generate");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <div className="text-4xl mb-4 animate-pulse">🧠</div>
        <p className="font-semibold text-lg mb-2">Analyzing your episode...</p>
        <p className="text-zinc-500 text-sm">Claude is reading the full transcript</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 font-semibold mb-2">❌ Analysis failed</p>
          <p className="text-zinc-400 text-sm">{error}</p>
          <button onClick={() => router.push("/upload")} className="mt-4 text-violet-400 text-sm hover:underline">
            Go back to upload
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl tracking-tight">Analysis Results</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{summary}</p>
        </div>
        <div className="flex gap-2">
          {themes.map(t => (
            <span key={t} className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full">{t}</span>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-8 w-fit">
          {(["quotes", "clips"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors capitalize
                ${activeTab === tab ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {tab === "quotes" ? `💬 Quotes (${quotes.length})` : `✂️ Clips (${clips.length})`}
            </button>
          ))}
        </div>

        {/* Quotes tab */}
        {activeTab === "quotes" && (
          <div className="space-y-4">
            {quotes.map((q, i) => (
              <div
                key={i}
                onClick={() => toggleQuote(i)}
                className={`border rounded-2xl p-6 cursor-pointer transition-all
                  ${selectedQuotes.has(i)
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium leading-relaxed mb-3">"{q.text}"</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{q.speaker}</span>
                      <span>·</span>
                      <span className="text-violet-400">{q.theme}</span>
                      <span>·</span>
                      <span>⏱ {formatTime(q.start_time)}</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">💡 {q.why_viral}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1
                    ${selectedQuotes.has(i) ? "border-violet-500 bg-violet-500" : "border-zinc-600"}`}>
                    {selectedQuotes.has(i) && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clips tab */}
        {activeTab === "clips" && (
          <div className="space-y-4">
            {clips.map((c, i) => (
              <div
                key={i}
                onClick={() => toggleClip(i)}
                className={`border rounded-2xl p-6 cursor-pointer transition-all
                  ${selectedClips.has(i)
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{c.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${CLIP_TYPE_COLORS[c.clip_type] || "bg-zinc-700 text-zinc-300"}`}>
                        {c.clip_type}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-3">{c.summary}</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>⏱ {formatTime(c.start_time)} → {formatTime(c.end_time)}</span>
                      <span>·</span>
                      <span>{Math.round(c.end_time - c.start_time)}s</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">💡 {c.why_viral}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1
                    ${selectedClips.has(i) ? "border-violet-500 bg-violet-500" : "border-zinc-600"}`}>
                    {selectedClips.has(i) && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sticky footer — shows when something is selected */}
        {(selectedQuotes.size > 0 || selectedClips.size > 0) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl">
            <p className="text-sm text-zinc-400">
              <span className="text-white font-semibold">{selectedQuotes.size} quotes</span> · <span className="text-white font-semibold">{selectedClips.size} clips</span> selected
            </p>
            <button
              onClick={handleGenerate}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2 rounded-xl transition-colors text-sm"
            >
              Generate Content →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}