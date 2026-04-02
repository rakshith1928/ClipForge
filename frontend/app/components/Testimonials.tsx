import React from 'react';
import { testimonials } from '../data/mockData';

export const Testimonials = () => {
  return (
    <section className="py-32 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-headline font-bold text-white">Loved by the top 1%</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="glass-card p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex gap-1 text-primary mb-6">
                  {[1,2,3,4,5].map(star => (
                    <span key={star} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  ))}
                </div>
                <p className="text-on-surface font-body italic leading-relaxed">&quot;{testimonial.quote}&quot;</p>
              </div>
              <div className="flex items-center gap-4 mt-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  className="w-12 h-12 rounded-full object-cover" 
                  alt={`Headshot of ${testimonial.author}`} 
                  src={testimonial.image} 
                />
                <div>
                  <p className="text-white font-bold text-sm">{testimonial.author}</p>
                  <p className="text-on-surface-variant text-xs">{testimonial.handle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
