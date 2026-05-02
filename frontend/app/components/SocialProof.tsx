"use client";

import React, { useEffect, useRef } from 'react';

export const SocialProof = () => {
  const logos = ['PODCASTERS', 'STREAMLABS', 'CREATORCO', 'VIDFLOW', 'CLIPX'];

  return (
    <section className="py-12 border-y border-primary/5">
      <div className="max-w-7xl mx-auto px-8">
        <p className="text-center font-label-md text-label-md text-stone-400 mb-10 uppercase tracking-[0.25em] font-bold">
          Trusted by 5,000+ top creators
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
          {logos.map((logo) => (
            <span key={logo} className="text-2xl font-black">{logo}</span>
          ))}
        </div>
      </div>
    </section>
  );
};
