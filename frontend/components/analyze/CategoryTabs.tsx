"use client";

import React, { useState } from 'react';

const TABS = ["Clips", "Quotes", "Threads", "Knowledge", "Speakers"];

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
      <div className="mb-8 overflow-hidden">
         <div className="flex overflow-x-auto no-scrollbar px-6 gap-8 items-center border-b border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`pb-4 relative font-semibold text-sm flex-shrink-0 transition-colors ${
                activeTab === tab 
                  ? 'text-[#ba9eff] font-bold' 
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#ba9eff] shadow-[0_0_10px_#ba9eff]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Context/Topic Filters */}
      <div className="px-6 mb-8 overflow-hidden">
         <div className="flex overflow-x-auto no-scrollbar gap-2">
          {topics.map((topic, i) => {
            const isSelected = selectedTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => onTopicChange?.(isSelected ? null : topic)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                  isSelected 
                    ? 'bg-[#ba9eff] text-[#18181b] border-[#ba9eff] shadow-[0_0_15px_rgba(186,158,255,0.3)]' 
                    : 'bg-[#1b1b1d] text-zinc-400 border-[rgba(73,69,81,0.15)] hover:text-white hover:border-zinc-600'
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
