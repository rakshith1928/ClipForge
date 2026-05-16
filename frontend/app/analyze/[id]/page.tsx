"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { AnalysisHeader } from '../../../components/analyze/AnalysisHeader';
import { MediaPlaybackBar } from '../../../components/analyze/MediaPlaybackBar';
import { CategoryTabs } from '../../../components/analyze/CategoryTabs';
import { ClipCard } from '../../../components/analyze/ClipCard';
import { TranscriptView } from '../../../components/analyze/TranscriptView';
import type { Clip as FrontendClip } from '../../data/analyzeMockData';
import { usePlaybackStore } from '../../../store/usePlaybackStore';

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
  episode?: {
    words: any[];
    title: string;
    summary: string;
  };
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
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : "text-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#ffe9e3] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold ${color}`}>{score}</span>
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
      className="text-xs font-bold text-[#8d7168] hover:text-primary transition-colors flex items-center gap-1"
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
        className="inline-block premium-gradient-bg glow-shadow text-white text-xs font-bold px-4 py-2 rounded-full transition-colors active:scale-95"
      >
        ⬇️ Download
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 disabled:opacity-50 text-xs font-bold px-4 py-2 rounded-full transition-colors active:scale-95 shadow-sm shadow-primary/10"
    >
      {loading ? "Generating..." : label}
    </button>
  );
}

export default function AnalyzeIDPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("Clips");
  const [isSyncing, setIsSyncing] = useState(true);
  const [statusText, setStatusText] = useState("Analyzing...");
  const [error, setError] = useState<string | null>(null);

  // Playback Store
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);
  const setTotalDuration = usePlaybackStore(state => state.setTotalDuration);
  const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Filtering State
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

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
    let isCancelled = false;
    let retryCount = 0;
    let timerId: NodeJS.Timeout;

    const pollAnalysis = async () => {
      try {
        const res = await fetch(`${API_BASE}/analyze/${params.id}`);

        if (res.status === 404) {
          timerId = setTimeout(pollAnalysis, 3000);
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

          if (data.episode?.filename) {
            setAudioUrl(`${API_BASE}/files/${data.episode.filename}`);
          }

          if (data.episode?.duration) {
            setTotalDuration(data.episode.duration);
          }

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
              aiHook: c.hook_rewritten || "",
              clipType: c.clip_type || "insight",
              whyViral: c.why_viral || ""
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
          setError(null);
        } else {
          throw new Error(`Server returned ${res.status}`);
        }
      } catch (err) {
        console.error("Polling failed:", err);
        setError("Connection lost. Reconnecting...");
        
        retryCount++;
        const nextDelay = Math.min(3000 * Math.pow(1.5, retryCount), 15000);
        timerId = setTimeout(pollAnalysis, nextDelay);
      }
    };

    pollAnalysis();

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
    };
  }, [params.id]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
  };

  const handleClipPlay = (startTime: number) => {
    seekTo(startTime);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Play failed", e));
      setIsPlaying(true);
    }
    // Scroll to player if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtering Logic
  const filteredClips = useMemo(() => {
    if (!selectedTopic) return clips;
    return clips.filter(clip =>
      clip.summary.toLowerCase().includes(selectedTopic.toLowerCase()) ||
      clip.title.toLowerCase().includes(selectedTopic.toLowerCase()) ||
      (clip.clipType && clip.clipType.toLowerCase() === selectedTopic.toLowerCase())
    );
  }, [clips, selectedTopic]);

  const filteredQuotes = useMemo(() => {
    if (!selectedTopic) return fullAnalysis?.quotes || [];
    return (fullAnalysis?.quotes || []).filter(quote =>
      quote.text.toLowerCase().includes(selectedTopic.toLowerCase()) ||
      quote.theme.toLowerCase().includes(selectedTopic.toLowerCase())
    );
  }, [fullAnalysis, selectedTopic]);

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
    <ProtectedRoute>
      <div className="bg-background text-text-primary font-body-md selection:bg-primary/20 min-h-screen pb-32">
        <AnalysisHeader statusText={statusText} isSyncing={isSyncing} error={error} />

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={(e) => setTotalDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        <MediaPlaybackBar onToggle={togglePlay} onSeek={seekTo} />

        <header className="max-w-[1280px] mx-auto px-8 mb-8 mt-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold text-primary uppercase tracking-wider">AI Analysis Complete</span>
          </div>
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight text-gradient mb-4">
            {episodeMetadata.title}
          </h1>
          <p className="text-[#594139] text-[18px] max-w-2xl leading-relaxed">
            {episodeMetadata.summary}
          </p>
        </header>

        <CategoryTabs
          topics={topics}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
        />

        <main className="px-8 max-w-[1280px] mx-auto space-y-6">

          {/* ── CLIPS TAB ── */}
          {activeTab === "Clips" && filteredClips.length > 0 && (
            <>
              {filteredClips.map(clip => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onGenerate={handleGenerateClip}
                  onPlay={handleClipPlay}
                  isGenerating={generatingClipId === clip.id}
                  downloadUrl={generatingClipId === clip.id ? null : clipDownloadUrls[clip.id] ? `${API_BASE}${clipDownloadUrls[clip.id]}` : null}
                />
              ))}
            </>
          )}

          {activeTab === "Clips" && clips.length === 0 && isSyncing && (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[#594139] font-bold uppercase tracking-widest text-[10px]">Analyzing your podcast...</p>
              <p className="text-[#8d7168] text-sm mt-1">This usually takes 15–30 seconds</p>
            </div>
          )}

          {/* ── QUOTES TAB ── */}
          {activeTab === "Quotes" && filteredQuotes.length > 0 && (
            <div className="space-y-4">
              {filteredQuotes.map((quote, i) => (
                <div key={i} className="glass-surface deep-boxed rounded-3xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ease-out">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[#261911] font-bold leading-relaxed mb-3 text-lg">"{quote.text}"</p>
                      <div className="flex items-center flex-wrap gap-3 text-[10px] font-label font-bold uppercase tracking-widest text-[#594139] mb-2">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span>{quote.speaker}</span>
                        <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">{quote.theme}</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span>{formatTime(quote.start_time)}</span>
                        <ViralScore score={quote.viral_score} />
                      </div>
                      {quote.why_viral && (
                        <p className="text-[#8d7168] text-xs mt-3 border-l-2 border-[#8d7168]/30 pl-3">💡 {quote.why_viral}</p>
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

          {/* ── TRANSCRIPT TAB ── */}
          {activeTab === "Transcript" && (
            <div className="h-[700px]">
              <TranscriptView
                words={fullAnalysis?.episode?.words || []}
                onSeek={seekTo}
              />
            </div>
          )}

          {/* ── THREADS TAB ── */}
          {activeTab === "Threads" && fullAnalysis && (
            <div className="space-y-6">
              {/* Twitter Thread */}
              {fullAnalysis.twitter_thread && fullAnalysis.twitter_thread.length > 0 && (
                <div className="glass-surface deep-boxed rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#261911]">𝕏 Twitter Thread</h3>
                    <CopyButton text={fullAnalysis.twitter_thread.join("\n\n")} />
                  </div>
                  <div className="space-y-3">
                    {fullAnalysis.twitter_thread.map((tweet, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-[#8d7168] text-sm w-6 shrink-0">{i + 1}.</span>
                        <p className="text-[#594139] text-sm leading-relaxed">{tweet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LinkedIn Post */}
              {fullAnalysis.linkedin_post && (
                <div className="glass-surface deep-boxed rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#261911]">💼 LinkedIn Post</h3>
                    <CopyButton text={fullAnalysis.linkedin_post} />
                  </div>
                  <p className="text-[#594139] text-sm leading-relaxed whitespace-pre-line">{fullAnalysis.linkedin_post}</p>
                </div>
              )}

              {/* Instagram Caption */}
              {fullAnalysis.instagram_caption && (
                <div className="glass-surface deep-boxed rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#261911]">📸 Instagram Caption</h3>
                    <CopyButton text={fullAnalysis.instagram_caption} />
                  </div>
                  <p className="text-[#594139] text-sm leading-relaxed whitespace-pre-line">{fullAnalysis.instagram_caption}</p>
                </div>
              )}

              {/* Controversial Moments */}
              {fullAnalysis.controversial_moments && fullAnalysis.controversial_moments.length > 0 && (
                <div className="glass-surface deep-boxed rounded-3xl p-6">
                  <h3 className="font-bold text-[#261911] mb-4">🔥 Controversial Moments</h3>
                  <div className="space-y-4">
                    {fullAnalysis.controversial_moments.map((m, i) => (
                      <div key={i} className="border-l-2 flex flex-col gap-1 border-primary/50 pl-4 bg-primary/5 p-3 rounded-r-xl">
                        <p className="text-[#8d7168] text-sm">{m.moment}</p>
                        <p className="text-[#594139] text-sm italic py-2">"{m.quote}"</p>
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
                { label: "📚 Key Lessons", items: fullAnalysis.knowledge_extracted.key_lessons, color: "#ab3500", bg: "bg-primary/5" },
                { label: "💡 Key Insights", items: fullAnalysis.knowledge_extracted.key_insights, color: "#ff6b35", bg: "bg-[#ff6b35]/5" },
                { label: "✅ Actionable Tips", items: fullAnalysis.knowledge_extracted.actionable_tips, color: "#594139", bg: "bg-surface-container" },
              ].map(({ label, items, color, bg }) => (
                <div key={label} className={`glass-surface deep-boxed rounded-3xl p-6 ${bg}`}>
                  <h3 className="font-bold mb-5 font-headline" style={{ color: color }}>{label}</h3>
                  <ul className="space-y-4">
                    {items && items.map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[#261911]">
                        <span className="shrink-0 opacity-70" style={{ color: color }}>→</span>
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
                <div key={i} className="glass-surface deep-boxed rounded-3xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white uppercase premium-gradient-bg glow-shadow">
                      {s.speaker.replace("Speaker ", "").charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-[#261911]">{s.speaker}</p>
                      <p className="text-[#8d7168] text-sm font-semibold">{s.best_moment}</p>
                    </div>
                  </div>
                  <p className="text-[#594139] text-sm italic border-l-2 border-primary/40 pl-4 py-2 bg-primary/5 rounded-r">"{s.quote}"</p>
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
    </ProtectedRoute>
  );
}
