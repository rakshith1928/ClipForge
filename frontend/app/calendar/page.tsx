// frontend/app/calendar/page.tsx
"use client";
import { useState, useEffect } from "react";

type Post = {
  id: string;
  content_type: string;
  content_body: string;
  scheduled_date: string;
  platform: string;
  status: string;
};

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "𝕏",
  linkedin: "💼",
  instagram: "📸",
};

const CONTENT_COLORS: Record<string, string> = {
  clip: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  quote: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  twitter_thread: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  linkedin: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  instagram: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-yellow-400",
  posted: "text-green-400",
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

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<string>("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [scheduling, setScheduling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  // Load episodes on mount
  useEffect(() => {
    fetch("http://localhost:8000/calendar/episodes")
      .then(r => r.json())
      .then(data => {
        const payload = data.data?.episodes || [];
        setEpisodes(payload);
        if (payload.length > 0) {
          setSelectedEpisode(payload[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Load posts when episode changes
  useEffect(() => {
    if (!selectedEpisode) return;
    setStatus("loading");
    fetch(`http://localhost:8000/calendar/posts/${selectedEpisode}`)
      .then(r => r.json())
      .then(data => {
        const posts = data.data?.posts || [];
        setPosts(posts);
        setStatus(posts.length > 0 ? "done" : "idle");
      })
      .catch(console.error);
  }, [selectedEpisode]);

  // Save current analysis to database
  const handleSaveContent = async () => {
    const episode = JSON.parse(sessionStorage.getItem("episode") || "{}");
    const analysis = JSON.parse(sessionStorage.getItem("analysis") || "{}");

    if (!episode.file_id) {
      alert("No episode found. Please upload first.");
      return;
    }

    setSaving(true);

    try {
      // Save episode
      await fetch("http://localhost:8000/calendar/save-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: episode.file_id,
          title: episode.title || "",
          transcript: episode.transcript,
          word_count: episode.word_count || 0,
          episode_summary: analysis.episode_summary || "",
          main_themes: analysis.main_themes || [],
          topics_discussed: analysis.topics_discussed || [],
        }),
      });

      // Save content
      await fetch("http://localhost:8000/calendar/save-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: episode.file_id,
          quotes: analysis.quotes || [],
          clips: analysis.clips || [],
          twitter_thread: analysis.twitter_thread || [],
          linkedin_post: analysis.linkedin_post || "",
          instagram_caption: analysis.instagram_caption || "",
        }),
      });

      // Refresh episodes list
      const res = await fetch("http://localhost:8000/calendar/episodes");
      const data = await res.json();
      const episodesList = data.data?.episodes || [];
      setEpisodes(episodesList);
      setSelectedEpisode(episode.file_id);
      alert("✅ Episode saved to database!");

    } catch (err) {
      alert("Failed to save. Check backend.");
    } finally {
      setSaving(false);
    }
  };

  // Generate 30-day schedule
  const handleSchedule = async () => {
    if (!selectedEpisode) return;
    setScheduling(true);

    try {
      await fetch("http://localhost:8000/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: selectedEpisode,
          start_date: startDate,
        }),
      });

      // Reload posts
      const res = await fetch(`http://localhost:8000/calendar/posts/${selectedEpisode}`);
      const data = await res.json();
      const scheduledPosts = data.data?.posts || [];
      setPosts(scheduledPosts);
      setStatus("done");

    } catch (err) {
      alert("Scheduling failed.");
    } finally {
      setScheduling(false);
    }
  };

  // Mark post as posted/skipped
  const updateStatus = async (postId: string, newStatus: string) => {
    await fetch(`http://localhost:8000/calendar/posts/${postId}/status?status=${newStatus}`, {
      method: "PATCH",
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p));
  };

  const grouped = groupByDate(posts);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl tracking-tight">Content Calendar</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Your 30-day auto-drip engine</p>
          </div>
          <button
            onClick={handleSaveContent}
            disabled={saving}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {saving ? "Saving..." : "💾 Save Current Episode"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Controls */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-3 gap-4">
            {/* Episode selector */}
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-2">Episode</label>
              <select
                value={selectedEpisode}
                onChange={e => setSelectedEpisode(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                {episodes.length === 0 && (
                  <option value="">No episodes saved yet</option>
                )}
                {episodes.map(ep => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Generate button */}
            <div className="flex items-end">
              <button
                onClick={handleSchedule}
                disabled={scheduling || !selectedEpisode}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {scheduling ? "Scheduling..." : "🗓️ Generate 30-Day Plan"}
              </button>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {posts.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Posts", value: posts.length },
              { label: "Scheduled", value: posts.filter(p => p.status === "scheduled").length },
              { label: "Posted", value: posts.filter(p => p.status === "posted").length },
              { label: "Days Covered", value: Object.keys(grouped).length },
            ].map(stat => (
              <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                <p className="text-2xl font-bold text-violet-400">{stat.value}</p>
                <p className="text-zinc-500 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar */}
        {status === "loading" && (
          <div className="text-center py-16 text-zinc-500">Loading calendar...</div>
        )}

        {status === "idle" && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🗓️</p>
            <p className="text-zinc-400 font-medium mb-2">No schedule yet</p>
            <p className="text-zinc-600 text-sm">Save your episode and click Generate 30-Day Plan</p>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dayPosts]) => (
              <div key={date}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-semibold text-zinc-300">{date}</p>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-600">{dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}</span>
                </div>

                {/* Day posts */}
                <div className="space-y-3">
                  {dayPosts.map(post => (
                    <div
                      key={post.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-start gap-4"
                    >
                      {/* Platform icon */}
                      <div className="text-2xl w-10 text-center flex-shrink-0">
                        {PLATFORM_ICONS[post.platform] || "📢"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${CONTENT_COLORS[post.content_type] || ""}`}>
                            {post.content_type.replace("_", " ")}
                          </span>
                          <span className={`text-xs capitalize ${STATUS_COLORS[post.status]}`}>
                            ● {post.status}
                          </span>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed line-clamp-2">
                          {post.content_body}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        {post.status === "scheduled" && (
                          <>
                            <button
                              onClick={() => updateStatus(post.id, "posted")}
                              className="text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              ✓ Posted
                            </button>
                            <button
                              onClick={() => updateStatus(post.id, "skipped")}
                              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Skip
                            </button>
                          </>
                        )}
                        {post.status !== "scheduled" && (
                          <button
                            onClick={() => updateStatus(post.id, "scheduled")}
                            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            Undo
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