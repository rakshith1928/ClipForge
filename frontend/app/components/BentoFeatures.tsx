"use client";

import React, { useEffect, useRef } from 'react';

export const BentoFeatures = () => {
  const sectionRef = useRef<HTMLElement>(null);

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
    <section id="features" className="py-xl relative" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[300px]">

          {/* Smart Scene Detection — large 2-row card */}
          <div
            className="md:col-span-8 md:row-span-2 glass-surface deep-boxed p-12 rounded-lg flex flex-col justify-between overflow-hidden bento-card-hover reveal"
            style={{ transitionDelay: '100ms' }}
          >
            <div>
              <div className="w-14 h-14 bg-primary-fixed rounded-xl flex items-center justify-center text-primary mb-6 shadow-sm">
                <span className="material-symbols-outlined text-4xl">view_agenda</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg mb-4">Smart Scene Detection</h3>
              <p className="text-body-lg text-on-surface-variant max-w-md font-medium">
                Our neural network identifies speaker changes, visual shifts, and narrative peaks to cut
                clips exactly where it matters.
              </p>
            </div>
            <div className="mt-8 flex gap-4">
              <div className="px-6 py-3 bg-white rounded-full text-primary font-bold shadow-sm border border-primary/10">
                Topic Detection
              </div>
              <div className="px-6 py-3 bg-white rounded-full text-primary font-bold shadow-sm border border-primary/10">
                Facial Tracking
              </div>
            </div>
          </div>

          {/* Dynamic Captions */}
          <div
            className="md:col-span-4 glass-surface deep-boxed p-8 rounded-lg bg-primary-container text-white border-none bento-card-hover reveal flex flex-col justify-center"
            style={{ transitionDelay: '200ms', background: 'var(--color-primary-container)' }}
          >
            <span
              className="material-symbols-outlined text-4xl mb-4"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              closed_caption
            </span>
            <h3 className="font-headline-md text-2xl mb-2">Dynamic Captions</h3>
            <p className="text-body-md opacity-90 font-medium">
              Auto-generate stylish, word-by-word captions that keep viewers engaged.
            </p>
          </div>

          {/* Social Scheduler */}
          <div
            className="md:col-span-4 glass-surface deep-boxed p-8 rounded-lg bento-card-hover reveal flex flex-col justify-center"
            style={{ transitionDelay: '300ms' }}
          >
            <span className="material-symbols-outlined text-primary text-4xl mb-4">schedule_send</span>
            <h3 className="font-headline-md text-xl mb-2">Social Scheduler</h3>
            <p className="text-body-md text-on-surface-variant font-medium">
              Plan your entire week of content in minutes.
            </p>
          </div>

          {/* Stats */}
          <div
            className="md:col-span-4 md:row-span-1 glass-surface deep-boxed p-8 rounded-lg flex flex-col justify-center text-center bento-card-hover reveal"
            style={{ transitionDelay: '400ms' }}
          >
            <div className="text-6xl font-black text-primary mb-2 tracking-tighter">10x</div>
            <p className="font-bold text-on-surface">Faster Content Creation</p>
          </div>

          {/* Team Collaboration */}
          <div
            className="md:col-span-8 md:row-span-1 glass-surface deep-boxed p-8 rounded-lg flex items-center gap-8 bento-card-hover reveal"
            style={{ transitionDelay: '500ms' }}
          >
            <div className="flex -space-x-4">
              <div className="w-14 h-14 rounded-full border-4 border-white bg-stone-200 shadow-md" />
              <div className="w-14 h-14 rounded-full border-4 border-white bg-stone-300 shadow-md" />
              <div className="w-14 h-14 rounded-full border-4 border-white bg-stone-400 shadow-md" />
            </div>
            <div>
              <h4 className="font-black text-lg">Team Collaboration</h4>
              <p className="text-sm text-on-surface-variant font-medium">
                Work with your editors and managers in one shared workspace.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
