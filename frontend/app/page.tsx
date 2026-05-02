"use client";

import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { SocialProof } from './components/SocialProof';
import { Workflow } from './components/Workflow';
import { BentoFeatures } from './components/BentoFeatures';
import { Testimonials } from './components/Testimonials';
import { BottomCTA } from './components/BottomCTA';
import { Footer } from './components/Footer';

export default function Home() {
  return (
    <>
      <main className="min-h-screen bg-background text-on-background relative overflow-x-hidden w-full">
        <Navbar />
        <Hero />
        <SocialProof />
        <Workflow />
        <BentoFeatures />
        <Testimonials />
        <BottomCTA />
        <Footer />
      </main>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_12px_40px_rgba(171,53,0,0.4)] hover:scale-110 active:scale-95 transition-all z-50 cursor-pointer"
        aria-label="Open chat"
      >
        <span className="material-symbols-outlined text-3xl">chat</span>
      </button>
    </>
  );
}