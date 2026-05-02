"use client";

import React, { useEffect, useRef } from 'react';

export const Testimonials = () => {
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
    <section className="py-xl bg-surface-container-low overflow-hidden" ref={sectionRef}>
      <div className="max-w-7xl mx-auto px-8">
        <h2 className="font-headline-lg text-headline-lg text-center mb-16 reveal">
          Loved by creators worldwide
        </h2>
        <div className="flex flex-wrap gap-8 justify-center">

          {/* Testimonial 1 */}
          <div
            className="glass-surface deep-boxed p-10 rounded-lg max-w-sm reveal"
            style={{ transitionDelay: '100ms' }}
          >
            <div className="flex gap-1 text-orange-500 mb-4">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
              ))}
            </div>
            <p className="text-body-md italic mb-8 font-medium leading-relaxed">
              &ldquo;ClipForge literally saved me 20 hours a week. I just drop my podcast link and get 15
              viral-ready clips in minutes. It&apos;s magic.&rdquo;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-fixed shadow-inner" />
              <div>
                <p className="font-black">Sarah Jenkins</p>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">The Modern Creative</p>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div
            className="glass-surface deep-boxed p-10 rounded-lg max-w-sm reveal"
            style={{ transitionDelay: '200ms' }}
          >
            <div className="flex gap-1 text-orange-500 mb-4">
              {[1,2,3,4,5].map((s) => (
                <span key={s} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
              ))}
            </div>
            <p className="text-body-md italic mb-8 font-medium leading-relaxed">
              &ldquo;The AI actually understands context. It doesn&apos;t just cut randomly; it finds the
              actual punchlines and hooks. Incredible tool.&rdquo;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary-fixed shadow-inner" />
              <div>
                <p className="font-black">David Chen</p>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Tech Reviewer @ ChenVlog</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
