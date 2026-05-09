"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export interface AnalysisHeaderProps {
  statusText?: string;
  isSyncing?: boolean;
}

export function AnalysisHeader({ statusText = "Live Syncing...", isSyncing = true }: AnalysisHeaderProps) {
  const router = useRouter();

  return (
    <nav className="sticky top-0 w-full bg-[#fff8f5]/90 backdrop-blur-xl border-b border-[#e1bfb5]/30 flex items-center justify-between px-6 py-4 z-50">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="hover:opacity-80 transition-opacity active:scale-95 duration-200 text-[#594139]"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline font-semibold tracking-tight text-[#261911] text-lg">Analysis Results</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-[#e1bfb5]/50">
          {isSyncing ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          )}
          <span className="font-label text-[10px] font-bold uppercase tracking-wider text-green-600">
            {statusText}
          </span>
        </div>
        <button className="hover:opacity-80 transition-opacity active:scale-95 duration-200 text-[#594139]">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </nav>
  );
}
