"use client";

import React, { useState } from 'react';

export const TAB_NAMES = {
  CLIPS: "Clips",
  QUOTES: "Quotes",
  TRANSCRIPT: "Transcript",
  THREADS: "Threads",
  KNOWLEDGE: "Knowledge",
  SPEAKERS: "Speakers"
} as const;

export const TABS = Object.values(TAB_NAMES);

export interface CategoryTabsProps {
  topics: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedTopic?: string | null;
  onTopicChange?: (topic: string | null) => void;
}

export function CategoryTabs({
  topics,
  activeTab,
  onTabChange,
  selectedTopic,
  onTopicChange
}: CategoryTabsProps) {
  return (
    <>
      {/* Horizontal Tabs */}
      <div className="sticky top-[64px] w-full z-40 glass-surface border-b border-[rgba(255,107,53,0.2)] px-8 mb-8">
        <div className="max-w-[1280px] mx-auto flex items-center gap-6 py-3 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-[#594139] hover:bg-[#ffe9e3]'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-[#e1bfb5] mx-2 shrink-0"></div>
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/5 transition-all whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[18px]">add</span> New Analysis
          </button>
        </div>
      </div>

      {/* Context/Topic Filters */}
      <div className="px-8 mb-8 max-w-[1280px] mx-auto overflow-hidden">
        <div className="flex overflow-x-auto no-scrollbar gap-2">
          {topics.map((topic, i) => {
            const isSelected = selectedTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => onTopicChange?.(isSelected ? null : topic)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap border transition-all ${isSelected
                    ? 'premium-gradient-bg text-white border-transparent glow-shadow'
                    : 'bg-[#fff8f5] text-[#594139] border-[rgba(255,107,53,0.2)] hover:bg-[#ffe9e3] hover:text-primary'
                  }`}
              >
                {topic.startsWith("#") ? topic : `#${topic}`}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
