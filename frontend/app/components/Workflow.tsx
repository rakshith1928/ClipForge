"use client";

import React, { useEffect, useRef } from 'react';

export const Workflow = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sectionRef.current?.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
      return;
    }
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
    <section id="workflow" className="py-24 bg-stone-50" ref={sectionRef} aria-labelledby="workflow-heading">
      <div className="max-w-7xl mx-auto px-8">
        <div className="text-center mb-16 reveal">
          <h2 id="workflow-heading" className="font-headline-lg text-headline-lg text-stone-900 mb-4">
            From long-form to viral in 3 steps
          </h2>
          <p className="text-body-lg text-stone-600 font-medium max-w-2xl mx-auto">
            Our AI does the heavy lifting so you can focus on creating.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Step 1 */}
          <div
            className="relative reveal p-8 rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary"
            style={{ transitionDelay: '100ms' }}
          >
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-6">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                cloud_upload
              </span>
            </div>
            <h3 className="font-bold text-xl text-stone-900 mb-3">1. Upload Video</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Paste a URL or drop your file. We support MP4, MOV, MP3, WAV and all major platforms.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className="relative reveal p-8 rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            style={{ transitionDelay: '200ms' }}
          >
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-6">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                psychology
              </span>
            </div>
            <h3 className="font-bold text-xl text-stone-900 mb-3">2. AI Analysis</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              ClipForge scans for hooks, punchlines and insights — not random cuts.
            </p>
          </div>

          {/* Step 3 — primary */}
          <div
            className="relative reveal p-8 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center text-white mb-6">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                auto_awesome
              </span>
            </div>
            <h3 className="font-bold text-xl mb-3">3. Export &amp; Post</h3>
            <p className="text-sm text-white/90 leading-relaxed">
              Review clips, add captions, and push directly to your channels.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
