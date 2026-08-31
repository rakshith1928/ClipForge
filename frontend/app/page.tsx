// Landing page — Server Component (child components handle their own "use client")

import type { Metadata } from 'next';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { SocialProof } from './components/SocialProof';
import { Workflow } from './components/Workflow';
import { BentoFeatures } from './components/BentoFeatures';
import { Testimonials } from './components/Testimonials';
import { BottomCTA } from './components/BottomCTA';
import { Footer } from './components/Footer';

export const metadata: Metadata = {
  title: 'ClipForge — Turn long videos into viral clips',
  description:
    'Turn podcasts, webinars and streams into viral clips for TikTok, Reels and Shorts in one click. AI finds the most engaging moments automatically.',
  openGraph: {
    title: 'ClipForge — Turn long videos into viral clips',
    description:
      'AI-powered video repurposing for creators. Paste a URL, get 15 viral-ready clips in minutes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClipForge — Turn long videos into viral clips',
    description: 'AI finds your best moments and cuts viral clips automatically.',
  },
};

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-stone-900 focus:rounded-full focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to content
      </a>
      <main
        id="main-content"
        className="min-h-screen bg-background text-on-background relative overflow-x-hidden w-full"
      >
        <Navbar />
        <Hero />
        <SocialProof />
        <Workflow />
        <BentoFeatures />
        <Testimonials />
        <BottomCTA />
        <Footer />
      </main>
    </>
  );
}
