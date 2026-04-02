// frontend/app/analyze/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Quote = {
  text: string;
  speaker: string;
  theme: string;
  why_viral: string;
  viral_score: number;
  start_time: number;
  end_time: number;
};

type Clip = {
  title: string;
  summary: string;
  why_viral: string;
  clip_type: string;
  viral_score: number;
  hook_original: string;
  hook_rewritten: string;
  start_time: number;
  end_time: number;
};

type Analysis = {
  quotes: Quote[];
  clips: Clip[];
  episode_summary: string;
  main_themes: string[];
  topics_discussed: string[];
  controversial_moments: { moment: string; quote: string }[];
  knowledge_extracted: {
    key_lessons: string[];
    key_insights: string[];
    actionable_tips: string[];
  };
  speaker_highlights: { speaker: string; best_moment: string; quote: string }[];
  twitter_thread: string[];
  linkedin_post: string;
  instagram_caption: string;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ViralScore({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${score >= 80 ? "bg-green-400" : score >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${color}`}>{score}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-zinc-500 hover:text-violet-400 transition-colors"
    >
      {copied ? "✅ Copied" : "📋 Copy"}
    </button>
  );
}

function GenerateButton({
  label,
  onClick,
  loading,
  downloadUrl,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  downloadUrl: string | null;
}) {
  if (downloadUrl) {
    return (
      <a
        href={`http://localhost:8000${downloadUrl}`}
        download
        className="inline-block bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        ⬇️ Download
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
    >
      {loading ? "Generating..." : label}
    </button>
  );
}

const TABS = ["Clips", "Quotes", "Threads", "Knowledge", "Speakers"] as const;
type Tab = (typeof TABS)[number];

const CLIP_COLORS: Record<string, string> = {
  story: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  insight: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  debate: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  revelation: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  funny: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function AnalyzePage() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("Clips");
  const [clipStates, setClipStates] = useState<Record<number, { loading: boolean; url: string | null }>>({});
  const [quoteStates, setQuoteStates] = useState<Record<number, { loading: boolean; url: string | null }>>({});
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("episode");
    if (!raw) {
      setError("No episode found. Please upload first.");
      setStatus("error");
      return;
    }
    runAnalysis(JSON.parse(raw));
  }, []);

  const runAnalysis = async (episode: any) => {
    try {
      const res = await fetch("http://localhost:8000/analyze/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: episode.transcript,
          words: episode.words,
          episode_title: episode.title || "",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setAnalysis(data);
      sessionStorage.setItem("analysis", JSON.stringify(data));
      setStatus("done");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  const generateClip = async (index: number, clip: Clip) => {
    const episode = JSON.parse(sessionStorage.getItem("episode") || "{}");
    setClipStates(prev => ({ ...prev, [index]: { loading: true, url: null } }));
    try {
      const res = await fetch("http://localhost:8000/generate/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: episode.file_id,
          start_time: clip.start_time,
          end_time: clip.end_time,
          title: clip.title,
        }),
      });
      const data = await res.json();
      setClipStates(prev => ({ ...prev, [index]: { loading: false, url: data.download_url } }));
    } catch {
      setClipStates(prev => ({ ...prev, [index]: { loading: false, url: null } }));
    }
  };

  const generateQuoteCard = async (index: number, quote: Quote) => {
    setQuoteStates(prev => ({ ...prev, [index]: { loading: true, url: null } }));
    try {
      const res = await fetch("http://localhost:8000/generate/quote-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_text: quote.text,
          speaker: quote.speaker,
          theme: quote.theme,
        }),
      });
      const data = await res.json();
      setQuoteStates(prev => ({ ...prev, [index]: { loading: false, url: data.download_url } }));
    } catch {
      setQuoteStates(prev => ({ ...prev, [index]: { loading: false, url: null } }));
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <div className="text-4xl mb-4 animate-pulse">🧠</div>
        <p className="font-semibold text-lg mb-2">Analyzing your episode...</p>
        <p className="text-zinc-500 text-sm">Groq is reading the full transcript</p>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-8">
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

  if (!analysis) return null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="font-bold text-xl tracking-tight mb-1">Analysis Results</h1>
            <p className="text-zinc-400 text-sm max-w-2xl">{analysis.episode_summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {analysis.main_themes.map(t => (
              <span key={t} className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="max-w-5xl mx-auto mt-4 flex flex-wrap gap-2">
          {analysis.topics_discussed.map(t => (
            <span key={t} className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-1 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-8">
        <div className="max-w-5xl mx-auto flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab
                  ? "border-violet-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-white"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* ── Clips Tab ── */}
        {activeTab === "Clips" && (
          <div className="space-y-6">
            {analysis.clips.map((clip, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{clip.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${CLIP_COLORS[clip.clip_type] || ""}`}>
                        {clip.clip_type}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-3">{clip.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
                      <span>⏱ {formatTime(clip.start_time)} → {formatTime(clip.end_time)}</span>
                      <span>·</span>
                      <span>{Math.round(clip.end_time - clip.start_time)}s</span>
                      <span>·</span>
                      <ViralScore score={clip.viral_score} />
                    </div>
                  </div>
                  <GenerateButton
                    label="✂️ Generate Clip"
                    onClick={() => generateClip(i, clip)}
                    loading={clipStates[i]?.loading || false}
                    downloadUrl={clipStates[i]?.url || null}
                  />
                </div>

                {/* Hook rewrite */}
                <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">Hook Rewrite</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Original</p>
                      <p className="text-sm text-zinc-400 italic">"{clip.hook_original}"</p>
                    </div>
                    <div>
                      <p className="text-xs text-violet-400 mb-1">✨ AI Rewritten</p>
                      <p className="text-sm text-white font-medium">"{clip.hook_rewritten}"</p>
                    </div>
                  </div>
                </div>

                <p className="text-zinc-500 text-xs mt-3">💡 {clip.why_viral}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Quotes Tab ── */}
        {activeTab === "Quotes" && (
          <div className="space-y-4">
            {analysis.quotes.map((quote, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium leading-relaxed mb-3 text-lg">"{quote.text}"</p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                      <span>{quote.speaker}</span>
                      <span>·</span>
                      <span className="text-violet-400">{quote.theme}</span>
                      <span>·</span>
                      <span>⏱ {formatTime(quote.start_time)}</span>
                      <span>·</span>
                      <ViralScore score={quote.viral_score} />
                    </div>
                    <p className="text-zinc-500 text-xs">💡 {quote.why_viral}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <CopyButton text={quote.text} />
                    <GenerateButton
                      label="🎨 Quote Card"
                      onClick={() => generateQuoteCard(i, quote)}
                      loading={quoteStates[i]?.loading || false}
                      downloadUrl={quoteStates[i]?.url || null}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Threads Tab ── */}
        {activeTab === "Threads" && (
          <div className="space-y-6">
            {/* Twitter Thread */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">𝕏 Twitter Thread</h3>
                <CopyButton text={analysis.twitter_thread.join("\n\n")} />
              </div>
              <div className="space-y-3">
                {analysis.twitter_thread.map((tweet, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-600 text-sm w-6 flex-shrink-0">{i + 1}.</span>
                    <p className="text-zinc-300 text-sm leading-relaxed">{tweet}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* LinkedIn Post */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">💼 LinkedIn Post</h3>
                <CopyButton text={analysis.linkedin_post} />
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{analysis.linkedin_post}</p>
            </div>

            {/* Instagram Caption */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">📸 Instagram Caption</h3>
                <CopyButton text={analysis.instagram_caption} />
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{analysis.instagram_caption}</p>
            </div>

            {/* Controversial Moments */}
            {analysis.controversial_moments?.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-semibold mb-4">🔥 Controversial Moments</h3>
                <div className="space-y-4">
                  {analysis.controversial_moments.map((m, i) => (
                    <div key={i} className="border-l-2 border-orange-500 pl-4">
                      <p className="text-zinc-400 text-sm mb-1">{m.moment}</p>
                      <p className="text-white text-sm italic">"{m.quote}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Knowledge Tab ── */}
        {activeTab === "Knowledge" && analysis.knowledge_extracted && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "📚 Key Lessons", items: analysis.knowledge_extracted.key_lessons, color: "violet" },
              { label: "💡 Key Insights", items: analysis.knowledge_extracted.key_insights, color: "blue" },
              { label: "✅ Actionable Tips", items: analysis.knowledge_extracted.actionable_tips, color: "green" },
            ].map(({ label, items, color }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="font-semibold mb-4">{label}</h3>
                <ul className="space-y-3">
                  {items?.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-zinc-300">
                      <span className={`text-${color}-400 flex-shrink-0`}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* ── Speakers Tab ── */}
        {activeTab === "Speakers" && (
          <div className="space-y-4">
            {analysis.speaker_highlights?.map((s, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {s.speaker.replace("Speaker ", "")}
                  </div>
                  <div>
                    <p className="font-semibold">{s.speaker}</p>
                    <p className="text-zinc-400 text-sm">{s.best_moment}</p>
                  </div>
                </div>
                <p className="text-zinc-300 text-sm italic border-l-2 border-violet-500 pl-4">"{s.quote}"</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}