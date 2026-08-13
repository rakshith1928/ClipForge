// frontend/app/generate/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Episode = {
  id: string;
  title: string;
  summary?: string;
  duration?: number;
  status?: string;
};

export default function GeneratePage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/calendar/episodes`);
        const data = await r.json();
        if (!cancelled) setEpisodes(data.data?.episodes || []);
      } catch {
        if (!cancelled) setError("Failed to load episodes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ProtectedRoute>
      <main className="bg-background text-text-primary font-body-md min-h-screen pb-20">
        <div className="max-w-[1280px] mx-auto px-8 py-10">
          <header className="mb-8">
            <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold text-primary uppercase tracking-wider">Generate</span>
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight text-gradient mt-4">Create Clips &amp; Quote Cards</h1>
            <p className="text-[#594139] text-[18px] max-w-2xl leading-relaxed mt-2">
              Pick an episode to generate viral clips and shareable quote cards. Generation happens on the analysis page.
            </p>
          </header>

          {loading && (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[#594139] font-bold uppercase tracking-widest text-[10px]">Loading episodes...</p>
            </div>
          )}

          {error && <p className="text-rose-500 text-sm">{error}</p>}

          {!loading && !error && episodes.length === 0 && (
            <div className="py-16 text-center glass-surface deep-boxed rounded-3xl">
              <p className="text-[#594139] font-bold">No episodes yet</p>
              <button onClick={() => router.push("/upload")} className="mt-4 premium-gradient-bg glow-shadow text-white text-sm font-bold px-5 py-3 rounded-full">Upload an episode</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.map((ep) => (
              <div key={ep.id} className="glass-surface deep-boxed rounded-3xl p-6 flex flex-col gap-4">
                <h3 className="font-bold text-[#261911] text-lg line-clamp-2">{ep.title || "Untitled Episode"}</h3>
                {ep.summary && <p className="text-[#8d7168] text-sm line-clamp-3">{ep.summary}</p>}
                <button
                  onClick={() => router.push(`/analyze/${ep.id}`)}
                  className="mt-auto premium-gradient-bg glow-shadow text-white text-sm font-bold px-5 py-3 rounded-full active:scale-95 transition-transform"
                >
                  🎬 Generate Clips
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
