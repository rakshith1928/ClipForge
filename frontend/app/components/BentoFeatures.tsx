"use client";

import React, { useEffect, useRef } from 'react';

export const BentoFeatures = () => {
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
    <section id="features" className="py-20 relative" ref={sectionRef} aria-labelledby="features-heading">
      <div className="max-w-7xl mx-auto px-8">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[300px]">
          {/* Smart Scene Detection — large 2-row card */}
          <div
            className="md:col-span-8 md:row-span-2 bg-white border border-stone-100 shadow-sm hover:shadow-md transition-shadow p-10 md:p-12 rounded-2xl flex flex-col justify-between overflow-hidden reveal"
            style={{ transitionDelay: '100ms' }}
          >
            <div>
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-6">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  view_agenda
                </span>
              </div>
              <h3 className="font-bold text-2xl text-stone-900 mb-3">Smart Scene Detection</h3>
              <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                Neural detection of speaker changes, visual shifts and narrative peaks — cuts exactly where it matters.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-stone-50 rounded-full text-sm font-semibold text-stone-700 border border-stone-100">Topic Detection</span>
              <span className="px-4 py-2 bg-stone-50 rounded-full text-sm font-semibold text-stone-700 border border-stone-100">Facial Tracking</span>
            </div>
          </div>

          {/* Dynamic Captions */}
          <div
            className="md:col-span-4 bg-stone-900 text-white p-8 rounded-2xl flex flex-col justify-center reveal"
            style={{ transitionDelay: '200ms' }}
          >
            <span className="material-symbols-outlined text-2xl mb-4 text-white" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>
              closed_caption
            </span>
            <h3 className="font-bold text-xl mb-2">Dynamic Captions</h3>
            <p className="text-sm text-stone-300 leading-relaxed">Auto word-by-word captions that keep viewers watching.</p>
          </div>

          {/* Social Scheduler */}
          <div
            className="md:col-span-4 bg-white border border-stone-100 shadow-sm p-8 rounded-2xl flex flex-col justify-center reveal"
            style={{ transitionDelay: '300ms' }}
          >
            <span className="material-symbols-outlined text-orange-600 text-2xl mb-4" aria-hidden="true">
              schedule_send
            </span>
            <h3 className="font-bold text-lg text-stone-900 mb-2">Social Scheduler</h3>
            <p className="text-sm text-stone-600 leading-relaxed">Plan your week of content in minutes.</p>
          </div>

          {/* Stats */}
          <div
            className="md:col-span-4 bg-white border border-stone-100 shadow-sm p-8 rounded-2xl flex flex-col justify-center text-center reveal"
            style={{ transitionDelay: '400ms' }}
          >
            <div className="text-5xl font-black text-primary mb-2 tracking-tight">10x</div>
            <p className="text-sm font-semibold text-stone-700">Faster Content Creation</p>
          </div>

          {/* Team Collaboration */}
          <div
            className="md:col-span-8 bg-white border border-stone-100 shadow-sm p-8 rounded-2xl flex items-center gap-6 reveal"
            style={{ transitionDelay: '500ms' }}
          >
            <div className="flex -space-x-3" aria-hidden="true">
              <div className="w-10 h-10 rounded-full border-2 border-white bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600">A</div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-stone-300 flex items-center justify-center text-xs font-bold text-stone-600">J</div>
              <div className="w-10 h-10 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">+3</div>
            </div>
            <div>
              <h4 className="font-bold text-stone-900">Team Collaboration</h4>
              <p className="text-sm text-stone-600">Editors and managers in one shared workspace.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
