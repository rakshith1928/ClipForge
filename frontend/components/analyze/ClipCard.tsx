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
      className="glass-surface deep-boxed rounded-3xl p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ease-out"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-[#261911] mb-1">{clip.title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-label font-bold uppercase tracking-widest text-[#594139]">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {clip.duration}
            </span>
            <span className="text-white bg-primary px-3 py-1 rounded-full">
              Viral Score {clip.viralScore}/100
            </span>
          </div>
        </div>

        <button
          onClick={() => onPlay?.(clip.startTime)}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95 group/play border border-primary/20"
          title="Play Preview"
        >
          <span className="material-symbols-outlined text-[20px]">
            play_arrow
          </span>
        </button>
      </div>

      {clip.imageUrl ? (
        <div className="h-32 w-full rounded-xl mb-4 bg-surface-container overflow-hidden relative">
          <img
            alt={clip.title}
            className="w-full h-full object-cover opacity-80"
            src={clip.imageUrl}
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#fff8f5] to-transparent"></div>
        </div>
      ) : null}

      <p className="text-[#594139] text-sm mb-6 leading-relaxed">
        {clip.summary}
      </p>

      {/* Hook Comparison */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-surface-container border-l-2 border-[#e1bfb5]">
          <span className="text-[9px] font-label uppercase tracking-widest text-[#8d7168] mb-2 block">Original Hook</span>
          <p className="text-xs text-[#594139] italic">"{clip.originalHook}"</p>
        </div>
        <div className="p-4 rounded-xl bg-primary/5 border-l-2 border-primary">
          <span className="text-[9px] font-label uppercase tracking-widest text-primary mb-2 block">AI Rewritten Hook</span>
          <p className="text-xs text-[#261911] font-bold">"{clip.aiHook}"</p>
        </div>
      </div>

      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform premium-gradient-bg glow-shadow"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download Clip
        </a>
      ) : (
        <button
          onClick={() => onGenerate(clip)}
          disabled={isGenerating}
          className="w-full py-4 rounded-xl font-bold text-sm text-white active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 premium-gradient-bg glow-shadow"
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
