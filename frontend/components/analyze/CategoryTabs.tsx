"use client";

import React, { useState } from 'react';

const TABS = ["Clips", "Quotes", "Threads", "Knowledge", "Speakers"];

export interface CategoryTabsProps {
  topics: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function CategoryTabs({ topics, activeTab, onTabChange }: CategoryTabsProps) {
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
          {topics.map((topic, i) => (
            <button
              key={topic}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border ${
                i === 0 
                  ? 'bg-[#2a2a2c] text-[#ba9eff] border-[rgba(38,37,40,0.4)]' 
                  : 'bg-[#1b1b1d] text-zinc-400 border-[rgba(73,69,81,0.15)] hover:text-white transition-colors'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
