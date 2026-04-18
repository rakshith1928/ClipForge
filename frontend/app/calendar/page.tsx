// frontend/app/calendar/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";

type Post = {
  id: string;
  content_type: string;
  content_body: string;
  scheduled_date: string;
  platform: string;
  status: string;
};

// Replace hardcoded localhost where possible with an env var approach
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "𝕏",
  linkedin: "💼",
  instagram: "📸",
};

const CONTENT_COLORS: Record<string, string> = {
  clip: "bg-[#7c3aed]/20 text-[#d2bbff] border-[#7c3aed]/30",
  quote: "bg-[#7c3aed]/20 text-[#d2bbff] border-[#7c3aed]/30",
  twitter_thread: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  linkedin: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  instagram: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-[#d2bbff]",
  posted: "text-[#10b981]", // Success Accent
  skipped: "text-zinc-500",
};

function groupByDate(posts: Post[]): Record<string, Post[]> {
  return posts.reduce((acc, post) => {
    const date = new Date(post.scheduled_date).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric"
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {} as Record<string, Post[]>);
}

// In-house sleek Toast Component (Zinc Ether design)
const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
  <div
    className={`fixed bottom-6 right-6 transition-all duration-300 transform ${
      visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
    } bg-[#18181b] border border-[#27272a] shadow-2xl rounded-xl px-5 py-3.5 flex items-center gap-3 z-50`}
  >
    <span className="text-[#10b981] text-lg">✅</span>
    <span className="text-white text-sm font-medium">{message}</span>
  </div>
);

// Skeleton Timeline component for async fetches
const TimelineSkeleton = () => (
  <div className="space-y-6">
    {[1, 2].map((group) => (
      <div key={group} className="animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-4 bg-[#27272a] rounded w-24"></div>
          <div className="flex-1 h-px bg-[#27272a]"></div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-start gap-4 h-24">
              <div className="w-10 h-10 bg-[#27272a] rounded-full flex-shrink-0"></div>
              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <div className="h-4 bg-[#27272a] rounded w-16"></div>
                  <div className="h-4 bg-[#27272a] rounded w-20"></div>
                </div>
                <div className="h-3 bg-[#27272a] rounded w-[80%]"></div>
                <div className="h-3 bg-[#27272a] rounded w-[60%]"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduling, setScheduling] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  
  // Toast State
  const [toastMsg, setToastMsg] = useState("");
  const [toastVis, setToastVis] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVis(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setToastVis(false);
    }, 3000);
  };

  // Load episodes on mount
  const fetchEpisodes = async () => {
    try {
      const r = await fetch(`${API_BASE}/calendar/episodes`);
      const data = await r.json();
      const payload = data.data?.episodes || [];
      setEpisodes(payload);
      
      // Auto-select latest episode
      if (payload.length > 0 && !selectedEpisode) {
        setSelectedEpisode(payload[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to database");
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, []);

  // Load posts securely when episode changes
  useEffect(() => {
    if (!selectedEpisode) return;
    setStatus("loading");
    fetch(`${API_BASE}/calendar/posts/${selectedEpisode}`)
      .then(r => r.json())
      .then(data => {
        const payload = data.data?.posts || [];
        setPosts(payload);
        setStatus(payload.length > 0 ? "done" : "idle");
      })
      .catch((err) => {
        console.error(err);
        setStatus("idle");
      });
  }, [selectedEpisode]);

  // Generate 30-day schedule
  const handleSchedule = async () => {
    if (!selectedEpisode) return;
    setScheduling(true);

    try {
      await fetch(`${API_BASE}/calendar/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: selectedEpisode,
          start_date: startDate,
        }),
      });

      // Reload posts
      const res = await fetch(`${API_BASE}/calendar/posts/${selectedEpisode}`);
      const data = await res.json();
      const scheduledPosts = data.data?.posts || [];
      setPosts(scheduledPosts);
      setStatus("done");
      showToast("30-Day Plan Generated!");

    } catch (err) {
      showToast("Scheduling failed.");
    } finally {
      setScheduling(false);
    }
  };

  // Mark post as posted/skipped
  const updateStatus = async (postId: string, newStatus: string) => {
    try {
      await fetch(`${API_BASE}/calendar/posts/${postId}/status?status=${newStatus}`, { method: "PATCH" });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p));
      if (newStatus === "posted") showToast("Post marked as successful!");
    } catch (err) {
      showToast("Failed to update status");
    }
  };

  const grouped = groupByDate(posts);

  return (
    <main className="min-h-screen bg-[#09090b] text-[#e5e1e4] font-sans selection:bg-[#7c3aed]/30 relative pb-20">
      
      {/* Toast Overlay */}
      <Toast message={toastMsg} visible={toastVis} />

      {/* Header */}
      <div className="border-b border-[#27272a] px-5 sm:px-8 py-5 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Content Calendar</h1>
            <p className="text-[#a1a1aa] text-sm mt-0.5">Your 30-day auto-drip engine</p>
          </div>
          <button
            onClick={fetchEpisodes}
            className="w-full sm:w-auto bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            🔄 Refresh Database
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

        {/* Global Controls */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 sm:p-6 mb-8 hover:border-[#353437] transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Episode selector */}
            <div>
              <label className="text-xs text-[#a1a1aa] uppercase tracking-widest block mb-2 font-semibold">Episode</label>
              <select
                value={selectedEpisode}
                onChange={e => setSelectedEpisode(e.target.value)}
                className="w-full bg-[#0e0e10] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {episodes.length === 0 && (
                  <option value="">No episodes saved in DB</option>
                )}
                {episodes.map(ep => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title || "Untitled Episode"}
                  </option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="text-xs text-[#a1a1aa] uppercase tracking-widest block mb-2 font-semibold">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#0e0e10] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                style={{ colorScheme: "dark" }}
              />
            </div>

            {/* Generate button */}
            <div className="flex items-end mt-2 md:mt-0">
              <button
                onClick={handleSchedule}
                disabled={scheduling || !selectedEpisode}
                className="w-full bg-gradient-to-r from-[#7c3aed] to-[#d2bbff] hover:opacity-90 disabled:opacity-50 disabled:grayscale text-[#25005a] font-bold py-3 rounded-xl transition-all shadow-[0_4px_20px_-5px_rgba(124,58,237,0.4)]"
              >
                {scheduling ? "Scheduling..." : "🗓️ Generate 30-Day Plan"}
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Row */}
        {posts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Posts", value: posts.length },
              { label: "Scheduled", value: posts.filter(p => p.status === "scheduled").length },
              { label: "Posted", value: posts.filter(p => p.status === "posted").length, isSuccess: true },
              { label: "Days Covered", value: Object.keys(grouped).length },
            ].map(stat => (
              <div key={stat.label} className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col items-center justify-center">
                <p className={`text-3xl font-bold ${stat.isSuccess ? 'text-[#10b981]' : 'text-[#7c3aed]'}`}>
                  {stat.value}
                </p>
                <p className="text-[#a1a1aa] text-xs font-semibold uppercase tracking-wider mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar Timeline */}
        {status === "loading" && <TimelineSkeleton />}

        {status === "idle" && (
          <div className="text-center py-20 bg-[#18181b] border border-[#27272a] rounded-2xl">
            <p className="text-5xl mb-5 opacity-80">🗓️</p>
            <p className="text-white font-semibold text-lg mb-2">No schedule generated yet</p>
            <p className="text-[#a1a1aa] text-sm max-w-sm mx-auto">Select an episode from your database above and click "Generate 30-Day Plan" to launch the engine.</p>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, dayPosts]) => (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-4 mb-4">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">{date}</p>
                  <div className="flex-1 h-px bg-[#27272a]" />
                  <span className="text-xs font-semibold text-[#a1a1aa] bg-[#27272a]/50 px-2.5 py-1 rounded-full">
                    {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Day posts */}
                <div className="space-y-4">
                  {dayPosts.map(post => (
                    <div
                      key={post.id}
                      className="bg-[#18181b] border border-[#27272a] hover:border-[#4a4455] rounded-2xl p-5 flex flex-col sm:flex-row items-start gap-4 transition-colors"
                    >
                      {/* Platform icon */}
                      <div className="text-2xl w-12 h-12 bg-[#0e0e10] border border-[#27272a] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                        {PLATFORM_ICONS[post.platform] || "📢"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${CONTENT_COLORS[post.content_type] || "bg-[#27272a] text-[#a1a1aa] border-[#353437]"}`}>
                            {post.content_type.replace("_", " ")}
                          </span>
                          <span className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${STATUS_COLORS[post.status]}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${post.status === 'posted' ? 'bg-[#10b981]' : post.status === 'scheduled' ? 'bg-[#d2bbff]' : 'bg-gray-500'}`}></div>
                            {post.status}
                          </span>
                        </div>
                        <p className="text-[#e5e1e4] text-sm leading-relaxed whitespace-pre-wrap line-clamp-3 hover:line-clamp-none transition-all">
                          {post.content_body}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {post.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => updateStatus(post.id, "posted")}
                              className="text-xs font-semibold bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none"
                            >
                              ✓ Posted
                            </button>
                            <button
                              onClick={() => updateStatus(post.id, "skipped")}
                              className="text-xs font-semibold bg-[#27272a]/50 hover:bg-[#353437] text-[#a1a1aa] px-4 py-2 rounded-lg transition-colors flex-1 sm:flex-none"
                            >
                              Skip
                            </button>
                          </>
                        )}
                        {post.status !== "scheduled" && (
                          <button
                            onClick={() => updateStatus(post.id, "scheduled")}
                            className="text-xs font-semibold text-[#7c3aed] hover:text-[#d2bbff] underline underline-offset-4 transition-colors p-2"
                          >
                            Undo Action
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}