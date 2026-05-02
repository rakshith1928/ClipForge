"use client";

import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-stone-100 w-full py-12 px-8 border-t border-stone-200">
      <div className="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto gap-6">
        <div className="flex items-center gap-2">
          <span className="font-black text-orange-600">ClipForge AI</span>
          <span className="text-sm text-stone-500 font-medium">
            © 2024 ClipForge AI. Crafted for creators.
          </span>
        </div>
        <div className="flex gap-8">
          {['Privacy', 'Terms', 'Security', 'Status'].map((item) => (
            <Link
              key={item}
              href="#"
              className="text-sm text-stone-500 font-bold hover:text-stone-900 transition-all duration-200"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};
