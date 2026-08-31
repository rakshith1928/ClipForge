"use client";

import React from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { isLoggedIn, user, logout, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Close mobile menu on Esc
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // During auth check: render a fixed-height skeleton so layout doesn't shift
  if (isLoading) {
    return (
      <header className="bg-stone-50/80 backdrop-blur-2xl top-0 sticky z-50 border-b border-orange-500/20 shadow-sm">
        <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto" aria-label="Primary">
          {/* Logo skeleton */}
          <div className="h-7 w-32 bg-orange-100 rounded-lg animate-pulse" />
          {/* Links skeleton */}
          <div className="hidden md:flex items-center gap-8">
            {[80, 72, 80, 64].map((w, i) => (
              <div key={i} className="h-4 bg-stone-200 rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
          {/* CTA skeleton */}
          <div className="h-9 w-28 bg-orange-200 rounded-full animate-pulse" />
        </nav>
      </header>
    );
  }

  return (
    <header
      id="site-header"
      className={`bg-stone-50/80 backdrop-blur-2xl top-0 sticky z-50 border-b border-orange-500/20 shadow-sm transition-transform duration-700 ease-in-out ${visible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto" aria-label="Primary">
        {/* Logo */}
        <Link href="/" className="text-2xl font-black tracking-tighter text-orange-600 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg">
          <span className="material-symbols-outlined text-orange-600" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
          ClipForge
        </Link>

        {/* Nav links - desktop */}
        <div className="hidden md:flex items-center gap-8 text-stone-700 font-medium">
          <a
            className="text-orange-600 font-bold border-b-2 border-orange-600 pb-1 hover:text-orange-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            href="#features"
          >
            Products
          </a>
          <a
            className="text-stone-600 hover:text-orange-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            href="#workflow"
          >
            Solutions
          </a>
          <a
            className="text-stone-600 hover:text-orange-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            href="#testimonials"
          >
            Resources
          </a>
          {/* Pricing — disabled during beta */}
          <span className="flex items-center gap-1.5 cursor-default select-none group relative">
            <span className="text-stone-400 font-medium">Pricing</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-black uppercase tracking-wider">
              Beta
            </span>
            {/* Tooltip */}
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-stone-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
              Free during beta 🎉
            </span>
          </span>
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              {user?.name && (
                <span className="hidden md:inline text-sm font-medium text-stone-600">
                  Hi, {user.name.split(' ')[0]}
                </span>
              )}
              <Link href="/dashboard" className="hidden sm:inline text-sm text-stone-600 hover:text-orange-500 transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="bg-primary text-white px-6 py-2.5 rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="hidden sm:inline-flex bg-primary text-white px-6 py-2.5 rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Get Started
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-stone-200 bg-white/95 backdrop-blur-xl"
        >
          <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col gap-4">
            <a href="#features" onClick={() => setMobileOpen(false)} className="py-3 text-stone-700 font-medium hover:text-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
              Products
            </a>
            <a href="#workflow" onClick={() => setMobileOpen(false)} className="py-3 text-stone-700 font-medium hover:text-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
              Solutions
            </a>
            <a href="#testimonials" onClick={() => setMobileOpen(false)} className="py-3 text-stone-700 font-medium hover:text-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
              Resources
            </a>
            <div className="flex items-center gap-2 py-3 text-stone-400">
              <span>Pricing</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-black uppercase tracking-wider">Beta</span>
            </div>
            {!isLoggedIn && (
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="mt-2 bg-primary text-white px-6 py-3 rounded-full font-bold text-center hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
