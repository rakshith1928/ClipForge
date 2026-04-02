import React from 'react';
import { trustedByLogos } from '../data/mockData';

export const SocialProof = () => {
  return (
    <section className="py-20 border-t border-outline-variant/10 relative z-10">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-on-surface-variant font-label text-xs tracking-widest uppercase mb-12">
          Trusted by 10,000+ hours of transcribed audio from top creators
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale contrast-125">
          {trustedByLogos.map((logo, idx) => (
            <div key={idx} className="text-2xl font-black text-white font-headline">
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
