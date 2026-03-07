// frontend/app/page.tsx
// This is the main landing/upload page of your app

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center text-sm font-bold">P</div>
          <span className="font-semibold text-lg tracking-tight">PodClip</span>
        </div>
        <div className="flex gap-6 text-sm text-zinc-400">
          <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
          <a href="/calendar" className="hover:text-white transition-colors">Content Calendar</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-medium px-3 py-1 rounded-full mb-6">
          AI-Powered Podcast Repurposing
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          Turn your podcast into<br />
          <span className="text-violet-400">30 days of content</span>
        </h1>
        <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">
          Upload a podcast episode. Get viral clips, quote cards, and a scheduled content calendar — automatically.
        </p>
        <a
          href="/upload"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg"
        >
          Upload Your First Episode →
        </a>
      </div>

      {/* Feature cards */}
      <div className="max-w-4xl mx-auto px-8 pb-24 grid grid-cols-3 gap-4">
        {[
          { icon: "🎙️", title: "Auto Transcription", desc: "Word-level timestamps with speaker detection" },
          { icon: "✂️", title: "Viral Clip Detection", desc: "AI finds the moments most likely to perform" },
          { icon: "🗓️", title: "Content Calendar", desc: "Drips quotes & clips to your socials daily" },
        ].map((f) => (
          <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-zinc-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}