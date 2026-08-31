"use client";

import React from 'react';

export const SocialProof = () => {
  const logos = ['PODCASTERS', 'STREAMLABS', 'CREATORCO', 'VIDFLOW', 'CLIPX'];

  return (
    <section className="py-10 border-y border-stone-100 bg-white" aria-labelledby="social-proof-heading">
      <div className="max-w-7xl mx-auto px-8">
        <p
          id="social-proof-heading"
          className="text-center font-label-md text-label-md text-stone-500 mb-8 uppercase tracking-[0.2em] font-bold"
        >
          Trusted by 5,000+ top creators
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-60">
          {logos.map((logo) => (
            <span
              key={logo}
              className="text-lg md:text-xl font-black tracking-tight text-stone-600"
              aria-label={logo}
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
