import React from 'react';

export const Hero = () => {
  return (
    <section className="pt-40 pb-20 px-6 text-center max-w-5xl mx-auto relative z-10">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Hero Content */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low text-primary text-xs font-bold tracking-widest uppercase mb-8">
        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        ✨ AI-Powered Podcast Repurposing
      </div>
      <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tighter text-gradient mb-8 leading-[1.1]">
        Turn your podcast into <br className="hidden md:block" /> 30 days of viral content
      </h1>
      <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mx-auto mb-12 font-body font-light leading-relaxed">
        Upload an episode. Get viral clips, quote cards, and a scheduled content calendar—automatically. Powered by atmospheric intelligence.
      </p>

      {/* CTO Buttons */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-20">
        <button className="premium-gradient-bg text-white px-10 py-5 rounded-full text-lg font-bold glow-shadow flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
          Start for Free <span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <button className="glass-card text-on-surface px-10 py-5 rounded-full text-lg font-medium hover:bg-surface-container transition-all">
          View Demo
        </button>
      </div>

      {/* Hero Visual Map */}
      <div className="relative w-full max-w-5xl mx-auto mt-20">
        <div className="aspect-video glass-card rounded-lg overflow-hidden relative shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="w-full h-full object-cover opacity-60" alt="Futuristic interface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgNEs9NXjqY700thcEKEm8vjHFAGhrpbCamV0CB4zklVxOynsQqci1FN7LGmrYYJCKwGhZC__VVk_xwp0T5082-lNxgRx4sCA9Fk7zAettIokMpstgRLxg3AwDNWQUP3D0as-As5Z_QuZIFbEivb5dklnxzwlEzSHkFeV05gs-XYDiVHA6C7h4XvN-T__3tMRkMVyzSCGVyuPnOmPqrCnlJcZq6XuRMiBC6DGA7_PXbQM6KzsC3RF9Jw_YVyJPYH_0YS3nqC0l74gw"/>
          
          <div className="absolute top-10 left-10 glass-card p-6 rounded-2xl border border-primary/20 shadow-[-10px_20px_30px_rgba(0,0,0,0.5)] hidden lg:block max-w-[240px] text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full premium-gradient-bg flex items-center justify-center">
                <span className="material-symbols-outlined text-white">calendar_month</span>
              </div>
              <div className="text-xs">
                <p className="text-on-surface font-bold">Content Ready</p>
                <p className="text-on-surface-variant">32 Clips Generated</p>
              </div>
            </div>
            <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary w-4/5"></div>
            </div>
          </div>

          <div className="absolute bottom-10 right-10 glass-card p-6 rounded-2xl border border-secondary/20 shadow-[10px_20px_30px_rgba(0,0,0,0.5)] hidden lg:block max-w-[280px] text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              <p className="text-[10px] uppercase tracking-widest text-secondary font-bold">Viral Prediction</p>
            </div>
            <p className="text-2xl font-bold font-headline text-white mb-2">98.4%</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">High likelihood of trending on TikTok and Instagram Reels based on current hook trends.</p>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full premium-gradient-bg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_50px_rgba(186,158,255,0.5)]">
              <span className="material-symbols-outlined text-white text-5xl translate-x-1" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
