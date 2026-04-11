"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnalysisHeader } from '../../../components/analyze/AnalysisHeader';
import { MediaPlaybackBar } from '../../../components/analyze/MediaPlaybackBar';
import { CategoryTabs } from '../../../components/analyze/CategoryTabs';
import { ClipCard } from '../../../components/analyze/ClipCard';
import type { Clip as FrontendClip } from '../../data/analyzeMockData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Quote = {
  text: string;
  speaker: string;
  theme: string;
  why_viral: string;
  viral_score: number;
  start_time: number;
  end_time: number;
};

export type FullAnalysis = {
  quotes: Quote[];
  clips: any[]; // Kept generic here so we can map to FrontendClip correctly
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
  if (!seconds || seconds <= 0) return "0:00";
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
        href={`${API_BASE}${downloadUrl}`}
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
      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-violet-500/20"
    >
      {loading ? "Generating..." : label}
    </button>
  );
}

export default function AnalyzeIDPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("Clips");
  const [isSyncing, setIsSyncing] = useState(true);
  const [statusText, setStatusText] = useState("Analyzing...");

  // Real data state
  const [episodeMetadata, setEpisodeMetadata] = useState({
    title: "Podcast Analysis",
    summary: "Loading intelligence data from the backend..."
  });

  // Store the full analysis payload
  const [fullAnalysis, setFullAnalysis] = useState<FullAnalysis | null>(null);
  const [clips, setClips] = useState<FrontendClip[]>([]);
  const [topics, setTopics] = useState<string[]>([]);

  // Generation states
  const [generatingClipId, setGeneratingClipId] = useState<string | null>(null);
  const [clipDownloadUrls, setClipDownloadUrls] = useState<Record<string, string | null>>({});
  const [quoteStates, setQuoteStates] = useState<Record<number, { loading: boolean; url: string | null }>>({});

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let isCancelled = false;

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`${API_BASE}/analyze/${params.id}`);

        if (res.status === 404) {
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (isCancelled) return;

          setFullAnalysis(data);

          setEpisodeMetadata({
            title: data.episode?.title || "Untitled Podcast",
            summary: data.episode?.summary || data.episode_summary || ""
          });

          if (data.clips && data.clips.length > 0) {
            const mappedClips: FrontendClip[] = data.clips.map((c: any, i: number) => ({
              id: `clip-${i}`,
              title: c.title || `Clip ${i + 1}`,
              viralScore: c.viral_score || 0,
              duration: `${formatTime(c.start_time)} - ${formatTime(c.end_time)}`,
              startTime: c.start_time || 0,
              endTime: c.end_time || 0,
              summary: c.summary || "",
              originalHook: c.hook_original || "",
              aiHook: c.hook_rewritten || ""
            }));
            setClips(mappedClips);
          }

          if (data.topics_discussed && data.topics_discussed.length > 0) {
            setTopics(data.topics_discussed);
          } else if (data.main_themes && data.main_themes.length > 0) {
            setTopics(data.main_themes);
          }

          setStatusText("Complete");
          setIsSyncing(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.log("Failed to fetch from backend:", err);
      }
    };

    fetchAnalysis();
    pollInterval = setInterval(fetchAnalysis, 3000);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [params.id]);

  const handleGenerateClip = async (clip: FrontendClip) => {
    setGeneratingClipId(clip.id);
    setClipDownloadUrls(prev => ({ ...prev, [clip.id]: null }));
    try {
      const res = await fetch(`${API_BASE}/generate/clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: params.id,
          episode_id: params.id,
          start_time: clip.startTime,
          end_time: clip.endTime,
          title: clip.title,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClipDownloadUrls(prev => ({ ...prev, [clip.id]: data.download_url }));
      } else {
        const err = await res.json();
        alert(`Generation failed: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      alert("Network error during clip generation.");
    } finally {
      setGeneratingClipId(null);
    }
  };

  const generateQuoteCard = async (index: number, quote: Quote) => {
    setQuoteStates(prev => ({ ...prev, [index]: { loading: true, url: null } }));
    try {
      const res = await fetch(`${API_BASE}/generate/quote-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: params.id,
          quote_text: quote.text,
          speaker: quote.speaker,
          theme: quote.theme,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuoteStates(prev => ({ ...prev, [index]: { loading: false, url: data.download_url } }));
      } else {
        setQuoteStates(prev => ({ ...prev, [index]: { loading: false, url: null } }));
        alert("Failed to generate quote card.");
      }
    } catch {
      setQuoteStates(prev => ({ ...prev, [index]: { loading: false, url: null } }));
    }
  };

  return (
    <div className="bg-[#0e0e10] text-[#e5e1e4] font-body selection:bg-[#d3bfff]/30 min-h-screen pb-32 font-['Manrope']">
      <AnalysisHeader statusText={statusText} isSyncing={isSyncing} />

      <MediaPlaybackBar />

      <header className="px-6 mb-8">
        <h2
          className="text-2xl font-bold font-headline leading-tight mb-2"
          style={{
            background: "linear-gradient(to right, #ffffff, #ba9eff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          {episodeMetadata.title}
        </h2>
        <p className="text-[#cbc4d3] text-sm font-medium leading-relaxed">
          {episodeMetadata.summary}
        </p>
      </header>

      <CategoryTabs
        topics={topics}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="px-6 space-y-6">

        {/* ── CLIPS TAB ── */}
        {activeTab === "Clips" && clips.length > 0 && (
          <>
            {clips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onGenerate={handleGenerateClip}
                isGenerating={generatingClipId === clip.id}
                downloadUrl={generatingClipId === clip.id ? null : clipDownloadUrls[clip.id] ? `${API_BASE}${clipDownloadUrls[clip.id]}` : null}
              />
            ))}
          </>
        )}

        {activeTab === "Clips" && clips.length === 0 && isSyncing && (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#ba9eff] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-500 font-semibold">Analyzing your podcast...</p>
            <p className="text-zinc-600 text-sm mt-1">This usually takes 15–30 seconds</p>
          </div>
        )}

        {/* ── QUOTES TAB ── */}
        {activeTab === "Quotes" && fullAnalysis?.quotes && (
          <div className="space-y-4">
            {fullAnalysis.quotes.map((quote, i) => (
              <div key={i} className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 relative overflow-hidden group shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium leading-relaxed mb-3 text-lg">"{quote.text}"</p>
                    <div className="flex items-center flex-wrap gap-3 text-[10px] font-label font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span>{quote.speaker}</span>
                      <span className="text-[#ba9eff]">{quote.theme}</span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span>{formatTime(quote.start_time)}</span>
                      <ViralScore score={quote.viral_score} />
                    </div>
                    {quote.why_viral && (
                      <p className="text-zinc-500 text-xs mt-3">💡 {quote.why_viral}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 items-end">
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

        {/* ── THREADS TAB ── */}
        {activeTab === "Threads" && fullAnalysis && (
          <div className="space-y-6">
            {/* Twitter Thread */}
            {fullAnalysis.twitter_thread && fullAnalysis.twitter_thread.length > 0 && (
              <div className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">𝕏 Twitter Thread</h3>
                  <CopyButton text={fullAnalysis.twitter_thread.join("\n\n")} />
                </div>
                <div className="space-y-3">
                  {fullAnalysis.twitter_thread.map((tweet, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-zinc-600 text-sm w-6 flex-shrink-0">{i + 1}.</span>
                      <p className="text-[#e5e1e4] text-sm leading-relaxed">{tweet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LinkedIn Post */}
            {fullAnalysis.linkedin_post && (
              <div className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">💼 LinkedIn Post</h3>
                  <CopyButton text={fullAnalysis.linkedin_post} />
                </div>
                <p className="text-[#e5e1e4] text-sm leading-relaxed whitespace-pre-line">{fullAnalysis.linkedin_post}</p>
              </div>
            )}

            {/* Instagram Caption */}
            {fullAnalysis.instagram_caption && (
              <div className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">📸 Instagram Caption</h3>
                  <CopyButton text={fullAnalysis.instagram_caption} />
                </div>
                <p className="text-[#e5e1e4] text-sm leading-relaxed whitespace-pre-line">{fullAnalysis.instagram_caption}</p>
              </div>
            )}

            {/* Controversial Moments */}
            {fullAnalysis.controversial_moments && fullAnalysis.controversial_moments.length > 0 && (
              <div className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <h3 className="font-semibold text-white mb-4">🔥 Controversial Moments</h3>
                <div className="space-y-4">
                  {fullAnalysis.controversial_moments.map((m, i) => (
                    <div key={i} className="border-l-2 flex flex-col gap-1 border-orange-500/50 pl-4">
                      <p className="text-zinc-400 text-sm">{m.moment}</p>
                      <p className="text-white text-sm italic py-2">"{m.quote}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── KNOWLEDGE TAB ── */}
        {activeTab === "Knowledge" && fullAnalysis?.knowledge_extracted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "📚 Key Lessons", items: fullAnalysis.knowledge_extracted.key_lessons, color: "#ba9eff" },
              { label: "💡 Key Insights", items: fullAnalysis.knowledge_extracted.key_insights, color: "#60a5fa" },
              { label: "✅ Actionable Tips", items: fullAnalysis.knowledge_extracted.actionable_tips, color: "#4ade80" },
            ].map(({ label, items, color }) => (
              <div key={label} className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)] overflow-hidden">
                <h3 className="font-semibold mb-5 font-headline text-white" style={{ color: color }}>{label}</h3>
                <ul className="space-y-4">
                  {items && items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#cbc4d3]">
                      <span className="flex-shrink-0 opacity-70" style={{ color: color }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* ── SPEAKERS TAB ── */}
        {activeTab === "Speakers" && fullAnalysis?.speaker_highlights && (
          <div className="space-y-4">
            {fullAnalysis.speaker_highlights.map((s, i) => (
              <div key={i} className="bg-[#18181b] border border-[rgba(73,69,81,0.15)] rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white uppercase"
                    style={{ background: "linear-gradient(135deg, #ba9eff 0%, #8455ef 100%)" }}>
                    {s.speaker.replace("Speaker ", "").charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{s.speaker}</p>
                    <p className="text-zinc-400 text-sm">{s.best_moment}</p>
                  </div>
                </div>
                <p className="text-[#cbc4d3] text-sm italic border-l-2 border-[#ba9eff]/40 pl-4 py-1 bg-[#ba9eff]/5 rounded-r">"{s.quote}"</p>
              </div>
            ))}
          </div>
        )}

        {/* Placeholder for unhandled tabs/empty states */}
        {activeTab !== "Clips" && !isSyncing && !fullAnalysis && (
          <div className="py-12 text-center text-zinc-500 border border-zinc-800/50 rounded-2xl bg-[#1b1b1d]/30">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">hourglass_empty</span>
            <p className="font-semibold">Loading data for {activeTab} view...</p>
          </div>
        )}

      </main>
    </div>
  );
}
