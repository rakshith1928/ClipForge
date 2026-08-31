"use client";

import React, { useEffect, useRef } from 'react';

export const Testimonials = () => {
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
    <section id="testimonials" className="py-20 bg-stone-50" ref={sectionRef} aria-labelledby="testimonials-heading">
      <div className="max-w-7xl mx-auto px-8">
        <h2 id="testimonials-heading" className="font-bold text-3xl text-stone-900 text-center mb-12 reveal">
          Loved by creators worldwide
        </h2>
        <div className="flex flex-wrap gap-6 justify-center">
          {/* Testimonial 1 */}
          <figure
            className="bg-white border border-stone-100 shadow-sm p-8 rounded-2xl max-w-sm reveal"
            style={{ transitionDelay: '100ms' }}
          >
            <div className="flex gap-1 text-orange-500 mb-4" aria-label="5 out of 5 stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className="material-symbols-outlined text-[18px]" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
              ))}
            </div>
            <blockquote className="text-sm text-stone-700 leading-relaxed mb-6">
              &ldquo;ClipForge saved me 20 hours a week. I drop my podcast link and get 15 viral-ready clips in minutes. It&apos;s magic.&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700" aria-hidden="true">
                SJ
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">Sarah Jenkins</p>
                <p className="text-xs text-stone-500">The Modern Creative</p>
              </div>
            </figcaption>
          </figure>

          {/* Testimonial 2 */}
          <figure
            className="bg-white border border-stone-100 shadow-sm p-8 rounded-2xl max-w-sm reveal"
            style={{ transitionDelay: '200ms' }}
          >
            <div className="flex gap-1 text-orange-500 mb-4" aria-label="5 out of 5 stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className="material-symbols-outlined text-[18px]" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
              ))}
            </div>
            <blockquote className="text-sm text-stone-700 leading-relaxed mb-6">
              &ldquo;The AI understands context. It doesn&apos;t cut randomly — it finds the punchlines and hooks. Incredible.&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-sm font-bold text-stone-600" aria-hidden="true">
                DC
              </div>
              <div>
                <p className="text-sm font-bold text-stone-900">David Chen</p>
                <p className="text-xs text-stone-500">Tech Reviewer @ ChenVlog</p>
              </div>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};
