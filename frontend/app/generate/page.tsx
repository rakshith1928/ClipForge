// frontend/app/generate/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";

export default function GeneratePage() {
  const router = useRouter();
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Generation happens directly from the analysis page.</p>
          <button onClick={() => router.push("/analyze")} className="text-violet-400 hover:underline">
            ← Back To Analysis Page
          </button>
        </div>
      </main>
    </ProtectedRoute>
  );
}
