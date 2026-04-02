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
    <main className="min-h-screen bg-background text-on-surface relative overflow-x-hidden w-full">
      <Navbar />
      <Hero />
      <SocialProof />
      <Workflow />
      <BentoFeatures />
      <Testimonials />
      <BottomCTA />
      <Footer />
    </main>
  );
}