"use client";

import React, { useEffect, useRef } from 'react';

export const Workflow = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-xl bg-surface" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="text-center mb-24 reveal">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">
            From long-form to viral in 3 steps
          </h2>
          <p className="text-body-lg text-on-surface-variant font-medium">
            Our AI does the heavy lifting so you can focus on creating.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Step 1 */}
          <div
            className="relative reveal p-8 rounded-2xl bg-primary-container text-white shadow-[0_20px_50px_rgba(171,53,0,0.3)] border-2 border-white/20 hover:scale-105 transition-all duration-300"
            style={{ transitionDelay: '100ms' }}
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-8 shadow-inner">
              <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            </div>
            <h3 className="font-headline-md text-headline-md mb-4 text-2xl font-bold">1. Upload Video</h3>
            <p className="text-body-md text-white/90 font-medium">
              Paste a URL or upload your raw video file. We support all major formats and platforms.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className="relative reveal p-8 rounded-2xl bg-primary-container text-white shadow-[0_20px_50px_rgba(171,53,0,0.3)] border-2 border-white/20 hover:scale-105 transition-all duration-300"
            style={{ transitionDelay: '200ms' }}
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-8 shadow-inner">
              <span className="material-symbols-outlined text-3xl">psychology</span>
            </div>
            <h3 className="font-headline-md text-headline-md mb-4 text-2xl font-bold">2. AI Analysis</h3>
            <p className="text-body-md text-white/90 font-medium">
              ClipForge scans your video for key moments, humorous segments, and high-impact insights.
            </p>
          </div>

          {/* Step 3 */}
          <div
            className="relative reveal p-8 rounded-2xl bg-primary text-white shadow-[0_20px_50px_rgba(171,53,0,0.3)] border-2 border-white/20 hover:scale-105 transition-all duration-300"
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-8 shadow-inner">
              <span className="material-symbols-outlined text-3xl">auto_awesome</span>
            </div>
            <h3 className="font-headline-md text-headline-md mb-4 text-2xl font-bold">3. Export &amp; Post</h3>
            <p className="text-body-md text-white/90 font-medium">
              Review your AI-generated clips, add auto-captions, and push directly to your social channels.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
