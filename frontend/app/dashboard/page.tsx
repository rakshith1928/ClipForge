"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { API_BASE, apiFetch } from "../../lib/api";

type Episode = {
  id: string;
  title: string;
  summary?: string;
  duration?: number;
  status?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await apiFetch(`${API_BASE}/calendar/episodes`);
        if (!r.ok) throw new Error("Failed to fetch");
        const data = await r.json();
        if (!cancelled) setEpisodes(data.data?.episodes || []);
      } catch {
        if (!cancelled) setError("Failed to load episodes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-stone-50 pb-20">
        <div className="max-w-[1280px] mx-auto px-8 py-10">
          <header className="mb-8">
            <span className="inline-flex px-3 py-1 bg-orange-50 border border-orange-100 rounded-full text-[11px] font-bold text-orange-700 uppercase tracking-wider">Dashboard</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-900 mt-4">Your Episodes</h1>
            <p className="text-stone-600 max-w-2xl leading-relaxed mt-2">Manage and repurpose every podcast you have uploaded.</p>
          </header>

          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => router.push("/upload")}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-5 py-3 rounded-full hover:bg-primary/90 active:scale-95 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
              Upload Episode
            </button>
            <button
              onClick={() => router.push("/calendar")}
              className="inline-flex items-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold px-5 py-3 rounded-full hover:bg-stone-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">calendar_month</span>
              Content Calendar
            </button>
          </div>

          {loading && (
            <div className="py-16 text-center" role="status" aria-live="polite">
              <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" aria-hidden="true"></div>
              <p className="text-stone-500 font-medium text-sm">Loading episodes...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && episodes.length === 0 && (
            <div className="py-16 text-center bg-white border border-stone-100 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-orange-600" aria-hidden="true">podcasts</span>
              </div>
              <p className="font-bold text-stone-900">No episodes yet</p>
              <p className="text-sm text-stone-500 mt-1">Upload your first episode to get started.</p>
              <button
                onClick={() => router.push("/upload")}
                className="mt-4 bg-primary text-white text-sm font-bold px-5 py-3 rounded-full hover:bg-primary/90 transition-colors"
              >
                Upload your first episode
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.map((ep) => (
              <div key={ep.id} className="bg-white border border-stone-100 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-stone-900 text-lg leading-tight line-clamp-2">{ep.title || "Untitled Episode"}</h3>
                {ep.summary ? <p className="text-stone-600 text-sm leading-relaxed line-clamp-3">{ep.summary}</p> : <p className="text-stone-400 text-sm">No summary yet — analyze to generate.</p>}
                <div className="flex flex-wrap gap-2 mt-auto">
                  <button
                    onClick={() => router.push(`/analyze/${ep.id}`)}
                    className="inline-flex items-center gap-1.5 bg-stone-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">search</span>
                    Analyze
                  </button>
                  <button
                    onClick={() => router.push(`/generate`)}
                    className="inline-flex items-center gap-1.5 bg-white border border-stone-200 text-stone-700 text-xs font-bold px-4 py-2 rounded-full hover:bg-stone-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">movie</span>
                    Generate
                  </button>
                  <button
                    onClick={() => router.push(`/calendar?episode=${ep.id}`)}
                    className="inline-flex items-center gap-1.5 bg-white border border-stone-200 text-stone-700 text-xs font-bold px-4 py-2 rounded-full hover:bg-stone-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">calendar_today</span>
                    Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
