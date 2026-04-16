"use client";

import React, { useState } from 'react';
import type { Clip } from '../../app/data/analyzeMockData';

export interface ClipCardProps {
  clip: Clip;
  onGenerate: (clip: Clip) => void;
  onPlay?: (startTime: number) => void;
  isGenerating?: boolean;
  downloadUrl?: string | null;
}

export function ClipCard({ clip, onGenerate, onPlay, isGenerating = false, downloadUrl }: ClipCardProps) {
  return (
    <article
      className="bg-[#18181b] rounded-2xl p-5 relative overflow-hidden group"
      style={{
        border: "1px solid rgba(73, 69, 81, 0.15)",
        boxShadow: "0 0 40px -10px rgba(186, 158, 255, 0.05)" // Subtle glow
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{clip.title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-label font-bold uppercase tracking-widest text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {clip.duration}
            </span>
            <span className="text-[#ba9eff] bg-[#ba9eff]/10 px-2 py-0.5 rounded">
              Viral Score {clip.viralScore}/100
            </span>
          </div>
        </div>

        <button
          onClick={() => onPlay?.(clip.startTime)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          style={{
            background: "rgba(38, 37, 40, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#ba9eff",
            border: "1px solid transparent"
          }}
          title="Play Preview"
        >
          <span className="material-symbols-outlined">
            play_circle
          </span>
        </button>
      </div>

      {clip.imageUrl ? (
        <div className="h-32 w-full rounded-xl mb-4 bg-zinc-900 overflow-hidden relative">
          <img
            alt={clip.title}
            className="w-full h-full object-cover opacity-60"
            src={clip.imageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent"></div>
        </div>
      ) : null}

      <p className="text-[#cbc4d3] text-sm mb-6 leading-relaxed">
        {clip.summary}
      </p>

      {/* Hook Comparison */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#1b1b1d]/50 border-l-2 border-zinc-700">
          <span className="text-[9px] font-label uppercase tracking-widest text-zinc-500 mb-2 block">Original Hook</span>
          <p className="text-xs text-zinc-400 italic">"{clip.originalHook}"</p>
        </div>
        <div className="p-4 rounded-xl bg-[#ba9eff]/5 border-l-2 border-[#ba9eff]">
          <span className="text-[9px] font-label uppercase tracking-widest text-[#ba9eff] mb-2 block">AI Rewritten Hook</span>
          <p className="text-xs text-white font-medium">"{clip.aiHook}"</p>
        </div>
      </div>

      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)" }}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download Clip
        </a>
      ) : (
        <button
          onClick={() => onGenerate(clip)}
          disabled={isGenerating}
          className="w-full py-4 rounded-xl font-bold text-sm text-white shadow-lg shadow-[#ba9eff]/20 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #ba9eff 0%, #8455ef 100%)" }}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Generating...
            </>
          ) : "Generate Clip"}
        </button>
      )}
    </article>
  );
}
