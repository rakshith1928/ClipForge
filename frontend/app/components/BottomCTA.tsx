import React from 'react';

export const BottomCTA = () => {
  return (
    <section className="py-32 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-surface-container-low border border-outline-variant/20 p-12 md:p-24 text-center">
          
          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 -z-10 w-full h-full pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -z-20 pointer-events-none"></div>
          
          <h2 className="text-4xl md:text-6xl font-headline font-bold text-white mb-8">Ready to scale your content?</h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto mb-12">Join 2,500+ podcasters who are growing their audience while they sleep.</p>
          
          <button className="premium-gradient-bg text-white px-12 py-5 rounded-full text-xl font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all">
            Upload Your First Episode
          </button>
          
          <p className="mt-8 text-xs text-on-surface-variant/60 font-label tracking-widest uppercase">
            No credit card required • 2 free episodes included
          </p>
        </div>
      </div>
    </section>
  );
};
