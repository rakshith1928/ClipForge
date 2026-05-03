"use client";

import React from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { isLoggedIn, user, logout, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return null;

  return (
    <header
      id="site-header"
      className={`bg-stone-50/80 backdrop-blur-[40px] top-0 sticky z-50 border-b border-orange-500/20 shadow-sm transition-transform duration-700 ease-in-out ${visible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      <nav className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="text-2xl font-black tracking-tighter text-orange-600 flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
          ClipForge
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-stone-700 font-medium">
          <a
            className="text-orange-600 font-bold border-b-2 border-orange-600 pb-1 hover:text-orange-700 transition-colors"
            href="#features"
          >
            Products
          </a>
          <a
            className="text-stone-600 hover:text-orange-500 transition-colors"
            href="#workflow"
          >
            Solutions
          </a>
          <a
            className="text-stone-600 hover:text-orange-500 transition-colors"
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
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-stone-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
              Free during beta 🎉
            </span>
          </span>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              {user?.name && (
                <span className="hidden md:inline text-sm font-medium text-stone-600">
                  Hi, {user.name.split(' ')[0]}
                </span>
              )}
              <Link href="/calendar" className="text-sm text-stone-600 hover:text-orange-500 transition-colors font-medium">
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="bg-primary text-white px-6 py-2.5 rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="bg-primary text-white px-6 py-2.5 rounded-full font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              Get Started
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};
