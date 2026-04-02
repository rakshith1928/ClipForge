import React from 'react';
import { workflowSteps } from '../data/mockData';

export const Workflow = () => {
  return (
    <section className="py-32 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20">
          <span className="text-primary font-label text-xs tracking-[0.2em] uppercase font-bold">The Workflow</span>
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mt-4">Three steps to dominance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-outline-variant/30 to-transparent -z-10"></div>
          
          {workflowSteps.map((step, idx) => (
            <div key={idx} className="group">
              <div className={`w-16 h-16 rounded-2xl glass-card flex items-center justify-center mb-8 border border-outline-variant/20 group-hover:border-${step.colorTheme}/50 transition-colors`}>
                <span className={`material-symbols-outlined text-${step.colorTheme} text-3xl`}>
                  {step.icon}
                </span>
              </div>
              <h3 className="text-xl font-headline font-bold text-white mb-4">{step.title}</h3>
              <p className="text-on-surface-variant leading-relaxed font-body">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
