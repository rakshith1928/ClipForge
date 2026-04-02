import React from 'react';
import Link from 'next/link';
import { navLinks } from '../data/mockData';

export const Navbar = () => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-transparent backdrop-blur-lg border-b border-outline-variant/10">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg premium-gradient-bg flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">P</div>
          <span className="text-xl font-bold tracking-tighter text-white font-headline">PodClip</span>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 font-jakarta text-sm font-medium tracking-tight">
          {navLinks.map((link, idx) => (
            <Link key={idx} href={link.href} className="text-slate-400 hover:text-primary transition-colors duration-300">
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth CTAs */}
        <div className="flex items-center gap-4">
          <button className="font-jakarta text-sm font-medium tracking-tight text-slate-400 hover:text-white transition-all">Log In</button>
          <button className="premium-gradient-bg text-on-primary-fixed px-6 py-2.5 rounded-full text-sm font-bold shadow-2xl shadow-violet-900/20 active:scale-95 transition-all">Sign Up</button>
        </div>

      </div>
    </nav>
  );
};
