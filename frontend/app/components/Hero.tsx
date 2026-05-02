"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const clips = [
  {
    label: 'Viral Hook #1',
    title: 'Growth Secrets',
    src: 'https://lh3.googleusercontent.com/aida/ADBb0uj7wZQS-UEJIAXXGP_LBap6a8dBQKv2yHkGlG8UhV5b9UfLXqY2nVjx46f7Idy1OA11GXqSYl4pxLohbmRF1tkspMr4ev2I1MJ3fmljvmmWTE5mDz8zrvLDGxMBKe26AL16x3gfvY7gdyu64WkEJCX616-e7rjezqYSkzRRQFUrO7_TfFX_WeeClSQGuEFZap3XTMn7iMAntcbTbGEubU5H-YoX14okggJNiBSy-odSg0xB2KoJQ1A_OWMmx74PXn6UynYzRX7NZHs',
  },
  {
    label: 'Insight #4',
    title: 'Mastery Mindset',
    src: 'https://lh3.googleusercontent.com/aida/ADBb0uh1KkSq4TS5yWk0xSKVDlNdaxZiUs7WS6gVqeakrEOfgdpzmgTJCO2yI08bqOuI4yG1PZhRlxtd-AGSgiuhWA6stgXT51SsxQMTnAP-ZVV2x-qyEEHMs0-z-PJ4-fQ3OgAvEuAwUCnL70nrTRHegPcXlpa9HTcQn8t-bOGQD_gI4_K0SwNUljuhBTd8dG0sv5m3DCKuQe1lxNOS8ObHiv-4O9CFONb0y97Xp9_6AKHBa3PSqlgOWwEZEGcqroxfboRQyR5IN5xAAUI',
  },
  {
    label: 'Quick Tip',
    title: 'Productivity Hacks',
    src: 'https://lh3.googleusercontent.com/aida/ADBb0ujf_aUMd0njawQ-UsSeNDOhG4l9WMttoWdqr7-6vxrKvpOr5pRlFsjLDLwLH8QQBu_dA2l_oXf5iT9-tSP2nrDEpjGv0N4cN0Epu-ZN3jL1YPKyBAB_oNwH5eujM835T3Mb-EU9VDjgMmrTiVKBv-St1J1WAq5VBC-HUt44vheMR4h54GqKKdK6DdrypqVRThmPCTHHXr6uujlNelI-CJoL11lha0uqX1OWu5eGAQmKuKl9xRFYoZm9D9XdmYGlAQ4RMqcx9hI1nxE',
  },
  {
    label: 'Highlight',
    title: 'Future Tech',
    src: 'https://lh3.googleusercontent.com/aida/ADBb0uhBdd_45fGQnEm3JwXkro-na1VRcmi9C9lRTuZqW0lG5ji973hsu6-fQx8J7EOxb-k0e31qPiru1ZJJin8Z-R-6fWlBtpoo4fJA1tnKZGI2cleicwHOOYfyeSgCYgHU6YuCSuNvEGLjDx9a8d6s7Dwp-2QKT-WyKG8L5H0AKF3kADMPs11MXUC7kkwb8LtlO2ME8VTVMhgjjrQHpeJ92zZO7wp5V9INkU8JmVOnxsDSbjWCxiGQXr9VdcUw4UqT1KJEq33G4b567Q',
  },
];

export const Hero = () => {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Staggered hero text fade-in after mount
    const els = headingRef.current?.querySelectorAll('.hero-text');
    const t = setTimeout(() => {
      els?.forEach(el => el.classList.remove('opacity-0', 'translate-y-4'));
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const handleGetClips = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a video URL.');
      return;
    }
    try {
      const parsed = new URL(trimmed);
      const allowed = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'www.youtube.com'];
      const isAllowed = allowed.some(h => parsed.hostname.endsWith(h));
      if (!isAllowed) {
        setUrlError('Only YouTube, Vimeo and Twitch URLs are supported.');
        return;
      }
    } catch {
      setUrlError('Please enter a valid URL.');
      return;
    }
    setUrlError('');
    if (isLoggedIn) {
      router.push(`/upload?url=${encodeURIComponent(trimmed)}`);
    } else {
      router.push(`/auth?redirect=${encodeURIComponent(`/upload?url=${encodeURIComponent(trimmed)}`)}`);
    }
  };

  return (
    <section className="relative pt-24 pb-48 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-primary-fixed/30 to-background organic-wave" />
        <div className="absolute top-40 -left-20 w-96 h-96 bg-secondary-container/40 rounded-full blur-[100px] opacity-60" />
        <div className="absolute top-20 -right-20 w-80 h-80 bg-primary-container/20 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto px-8 text-center flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-fixed font-label-md text-label-md mb-8">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          AI-Powered Video Repurposing
        </div>

        {/* Headline */}
        <h1 ref={headingRef} className="font-display-lg text-display-lg text-on-background mb-8 max-w-4xl tracking-tight">
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-100 hero-text">Convert</span>{' '}
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-200 hero-text">long</span>{' '}
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-300 hero-text">videos</span>{' '}
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-400 hero-text">into</span>{' '}
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-500 hero-text text-primary italic">short-form</span>{' '}
          <span className="inline-block opacity-0 translate-y-4 transition-all duration-700 delay-600 hero-text">content</span>
        </h1>

        {/* Subheading */}
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-12">
          Turn your podcasts, webinars, and streams into viral clips for TikTok, Reels, and Shorts
          in one click. Optimized by AI to find the most engaging moments automatically.
        </p>

        {/* CTAs */}
        <div className="flex gap-4 items-center">
          <Link
            href={isLoggedIn ? '/upload' : '/auth'}
            className="bg-primary text-white px-10 py-5 rounded-full font-headline-md text-body-lg hover:scale-[1.05] active:scale-95 transition-all shadow-[0_12px_40px_-8px_rgba(171,53,0,0.4)] cursor-pointer"
          >
            Repurpose My Content
          </Link>
          <button className="glass-surface px-10 py-5 rounded-full font-headline-md text-body-lg border border-primary/20 hover:bg-white transition-all cursor-pointer">
            Watch Demo
          </button>
        </div>
      </div>

      {/* Interactive Showcase */}
      <div className="max-w-5xl mx-auto mt-24 px-8 relative">
        <div className="glass-surface deep-boxed rounded-lg p-4 relative z-10">

          {/* Main Video Player */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-900 shadow-inner group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Main Video Player"
              className="w-full h-full object-cover opacity-90"
              src="https://lh3.googleusercontent.com/aida/ADBb0uj9SJroHaJQnQMxg_6myDRpmfHFu6u8vH29_ruspJ9rYsLE_CRv51fH6dr3CybvNyC6hcQo0tu_0gjhLH9c_EpcuE-2tfzaczMK8KPF58sBjMiS8jUNr8juwSWh50XbXI5NEwOmIeHsVHeBgehgkfyO_7wHB6X-GxMwF8URPSxP-3wH5Xca7ULiBjsWQKUdf8pQmzOjJdgYJxz68Mfe6fFuzBg0LdGwR3xrlwTxD0ReB7IrgbHINfNAAcAdjtmCIAueEpuXNt0geHI"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-2xl">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </div>
            </div>
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-white text-xs font-medium">
              01:24:15 / 02:30:00
            </div>
          </div>

          {/* URL Input */}
          <div className="mt-8 mb-8">
            <div className={`flex gap-2 p-2 bg-white rounded-full border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all ${urlError ? 'border-red-400' : 'border-primary/10'}`}>
              <input
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-6 text-on-surface font-medium placeholder:text-stone-400"
                placeholder="Drop a long video URL (YouTube, Vimeo, Twitch)..."
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleGetClips()}
              />
              <button
                onClick={handleGetClips}
                className="bg-primary text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-surface-tint transition-colors"
              >
                <span className="material-symbols-outlined">magic_button</span>
                Get Clips
              </button>
            </div>
            {urlError && (
              <p className="text-red-500 text-sm mt-2 px-4 font-medium">{urlError}</p>
            )}
          </div>

          {/* Sliding Clip Row */}
          <div className="overflow-hidden w-full rounded-lg relative">
            <div className="clip-slider">
              {/* First set */}
              <div className="grid grid-cols-4 gap-4 w-1/2 flex-shrink-0 pr-4">
                {clips.map((clip, i) => (
                  <div key={i} className="aspect-[9/16] bg-stone-200 rounded-lg overflow-hidden relative shadow-lg border border-primary/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={clip.title} className="w-full h-full object-cover" src={clip.src} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{clip.label}</p>
                      <p className="text-xs font-semibold leading-tight">{clip.title}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Duplicate for seamless loop */}
              <div className="grid grid-cols-4 gap-4 w-1/2 flex-shrink-0 pr-4">
                {clips.map((clip, i) => (
                  <div key={i} className="aspect-[9/16] bg-stone-200 rounded-lg overflow-hidden relative shadow-lg border border-primary/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={clip.title} className="w-full h-full object-cover" src={clip.src} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{clip.label}</p>
                      <p className="text-xs font-semibold leading-tight">{clip.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
        <div className="absolute -inset-10 bg-primary/10 blur-[100px] -z-10 rounded-full" />
      </div>
    </section>
  );
};
