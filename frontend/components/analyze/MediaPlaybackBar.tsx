"use client";

import React, { useState } from 'react';

export interface MediaPlaybackBarProps {
  currentTime?: string;
  totalTime?: string;
}

export function MediaPlaybackBar({ currentTime = "02:14", totalTime = "45:00" }: MediaPlaybackBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="px-6 -mt-2 mb-6">
      <div 
        className="rounded-2xl p-4 flex items-center gap-4 relative"
        style={{
          background: "rgba(38, 37, 40, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(73, 69, 81, 0.15)",
          boxShadow: "0 0 40px -10px rgba(186, 158, 255, 0.3)"
        }}
      >
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          style={{ background: "linear-gradient(135deg, #ba9eff 0%, #8455ef 100%)" }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
        
        {/* Mock Waveform */}
        <div className="flex-1 flex items-end h-8 gap-[2px]">
          {[40, 60, 80, 50, 90, 30, 70, 40, 60, 20, 50, 100, 40, 60, 80].map((h, i) => (
            <div 
              key={i} 
              className="w-[2px] bg-[#ba9eff] rounded-[1px] mx-[1px]" 
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        
        <div className="font-label text-[10px] font-semibold text-[#cbc4d3]">
          {currentTime} / {totalTime}
        </div>
      </div>
    </div>
  );
}
