"use client";

import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-white w-full py-10 px-8 border-t border-stone-200">
      <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-6">
        <div className="flex items-center gap-3">
          <span className="font-black text-orange-600">ClipForge AI</span>
          <span className="text-sm text-stone-500">© 2026 ClipForge AI. Crafted for creators.</span>
        </div>
        <nav className="flex gap-6" aria-label="Footer">
          {[
            { label: 'Privacy', href: '/#features' },
            { label: 'Terms', href: '/#workflow' },
            { label: 'Security', href: '/#testimonials' },
            { label: 'Status', href: '/' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-stone-500 font-medium hover:text-stone-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};
