"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export const BottomCTA = () => {
  const { isLoggedIn } = useAuth();
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
    <section className="py-xl relative overflow-hidden bg-primary text-white" ref={sectionRef}>
      {/* Decorative wave */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg className="absolute bottom-0 w-full h-auto" viewBox="0 0 1440 320">
          <path
            d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,181.3C960,181,1056,139,1152,122.7C1248,107,1344,117,1392,122.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            fill="#ffffff"
            fillOpacity="1"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-8 relative z-10 text-center reveal">
        <h2 className="font-display-lg text-display-lg mb-8 tracking-tighter">
          Ready to multiply your reach?
        </h2>
        <p className="text-body-lg mb-12 opacity-90 max-w-2xl mx-auto font-medium">
          Join thousands of creators who are scaling their brand with AI-powered shorts. Get your
          first 3 videos free.
        </p>
        <Link
          href={isLoggedIn ? '/upload' : '/auth'}
          className="inline-block bg-white text-primary px-12 py-6 rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-[0_20px_50px_rgba(0,0,0,0.2)] active:scale-95"
        >
          {isLoggedIn ? 'Go to Upload' : 'Start Repurposing Now'}
        </Link>
        <p className="mt-6 text-sm opacity-70 font-medium">No credit card required. Cancel anytime.</p>
      </div>
    </section>
  );
};
