"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { navLinks } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { isLoggedIn, user, logout } = useAuth();

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
          {isLoggedIn ? (
            <>
              {user?.name && <span className="hidden md:inline text-sm font-medium text-slate-300">Hi, {user.name.split(' ')[0]}</span>}
              <Link href="/calendar" className="font-jakarta text-sm font-medium tracking-tight text-slate-400 hover:text-white transition-all">
                Dashboard
              </Link>
              <button 
                onClick={logout}
                className="premium-gradient-bg text-on-primary-fixed px-6 py-2.5 rounded-full text-sm font-bold shadow-2xl shadow-violet-900/20 active:scale-95 transition-all"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth" className="font-jakarta text-sm font-medium tracking-tight text-slate-400 hover:text-white transition-all">
                Log In
              </Link>
              <Link href="/auth" className="premium-gradient-bg text-on-primary-fixed px-6 py-2.5 rounded-full text-sm font-bold shadow-2xl shadow-violet-900/20 active:scale-95 transition-all">
                Sign Up
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
};
