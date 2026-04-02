import React from 'react';

export const BentoFeatures = () => {
  return (
    <section className="py-32 px-6 bg-surface-container-low/30 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl font-headline font-bold text-white">Engineered for Virality</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 h-auto md:h-[600px]">
          
          {/* Viral Prediction Card */}
          <div className="md:col-span-3 glass-card rounded-lg p-8 flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 -rotate-12 transition-transform group-hover:scale-175">
              <span className="material-symbols-outlined text-[120px] text-primary">trending_up</span>
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-6">Prediction Engine</span>
              <h3 className="text-3xl font-headline font-bold text-white mb-4">Performance Score</h3>
              <p className="text-on-surface-variant max-w-sm">Every clip is ranked by its likelihood to go viral based on real-time platform data.</p>
            </div>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="text-6xl font-black font-headline text-white">98</span>
              <span className="text-2xl text-primary font-bold">/ 100</span>
            </div>
          </div>

          {/* Speaker Intelligence */}
          <div className="md:col-span-3 glass-card rounded-lg p-8 flex flex-col justify-center text-center items-center group">
            <div className="w-20 h-20 rounded-full premium-gradient-bg mb-6 flex items-center justify-center shadow-2xl">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>face</span>
            </div>
            <h3 className="text-2xl font-headline font-bold text-white mb-4">Speaker Intelligence</h3>
            <p className="text-on-surface-variant max-w-xs">Automatic face tracking and active speaker detection for perfect vertical cropping.</p>
          </div>

          {/* Hook Generator */}
          <div className="md:col-span-2 glass-card rounded-lg p-8 flex flex-col justify-between border-t-2 border-tertiary/20">
            <h3 className="text-xl font-headline font-bold text-white mb-4">Hook Generator</h3>
            <div className="space-y-3">
              <div className="h-8 bg-surface-container-high rounded flex items-center px-3 text-[10px] text-on-surface-variant italic">&quot;Wait, did he just say that?&quot;</div>
              <div className="h-8 bg-surface-container-high rounded flex items-center px-3 text-[10px] text-on-surface-variant italic">&quot;The dark secret of Podcasting...&quot;</div>
              <div className="h-8 bg-primary/20 border border-primary/30 rounded flex items-center px-3 text-[10px] text-primary font-bold">&quot;Why 99% of podcasts fail.&quot;</div>
            </div>
          </div>

          {/* Content Calendar */}
          <div className="md:col-span-4 glass-card rounded-lg p-8 flex flex-col md:flex-row items-center gap-12 overflow-hidden border-t-2 border-secondary/20">
            <div className="flex-1">
              <h3 className="text-2xl font-headline font-bold text-white mb-4">Content Calendar</h3>
              <p className="text-on-surface-variant">Queue up a month&apos;s worth of content in 5 minutes. We handle the distribution.</p>
            </div>
            <div className="hidden lg:grid grid-cols-4 gap-2 opacity-50">
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
              <div className="w-12 h-16 bg-secondary rounded-md"></div>
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
              <div className="w-12 h-16 bg-primary rounded-md"></div>
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
              <div className="w-12 h-16 bg-surface-container rounded-md"></div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
