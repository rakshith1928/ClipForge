"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

export interface Word {
  word: string;
  start: number;
  end: number;
  speaker: number;
}

export interface TranscriptViewProps {
  words: Word[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptView({ words, currentTime, onSeek }: TranscriptViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Group words by speaker
  const groupedWords = React.useMemo(() => {
    const groups: { speaker: number; words: Word[] }[] = [];
    if (!words || words.length === 0) return groups;

    let currentGroup = { speaker: words[0].speaker ?? 0, words: [words[0]] };
    for (let i = 1; i < words.length; i++) {
      const spkr = words[i].speaker ?? 0;
      if (spkr === currentGroup.speaker) {
        currentGroup.words.push(words[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = { speaker: spkr, words: [words[i]] };
      }
    }
    groups.push(currentGroup);
    return groups;
  }, [words]);

  // Auto-scrolling logic
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  const speakerColors = [
    "border-[#ba9eff]", // Speaker 0 (Violet)
    "border-[#60a5fa]", // Speaker 1 (Blue)
    "border-[#4ade80]", // Speaker 2 (Green)
    "border-[#fbbf24]"  // Speaker 3 (Amber)
  ];

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[800px] bg-[#0e0e10] text-[#f9f5f8] rounded-2xl border border-[rgba(73,69,81,0.15)] overflow-hidden shadow-[0_0_40px_-10px_rgba(186,158,255,0.05)]">

      {/* Search Header */}
      <div className="p-4 border-b border-[rgba(73,69,81,0.15)] bg-[#131315]/90 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <Search className="w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-sm placeholder:text-zinc-500 text-[#e5e1e4]"
        />
      </div>

      {/* Transcript Feed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
      >
        {groupedWords.map((group, groupIdx) => (
          <div key={groupIdx} className="flex flex-col">
            <div className={`pl-5 border-l-2 ${speakerColors[group.speaker % speakerColors.length] || "border-zinc-500"}`}>
              <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3 block font-label">
                Speaker {group.speaker}
              </span>
              <div className="leading-relaxed text-[#e5e1e4]/80 text-lg font-body">
                {group.words.map((w, wIdx) => {
                  const isActive = currentTime >= w.start && currentTime <= w.end;
                  const isMatch = searchQuery && w.word.toLowerCase().includes(searchQuery.toLowerCase());

                  return (
                    <span
                      key={wIdx}
                      ref={isActive ? activeWordRef : null}
                      onClick={() => onSeek(w.start)}
                      className={`
                        cursor-pointer transition-all duration-200 inline-block mr-[0.3em] hover:text-[#ba9eff] hover:bg-[#ba9eff]/10 rounded px-1
                        ${isActive ? "text-transparent bg-clip-text bg-gradient-to-r from-[#ffffff] to-[#ba9eff] font-bold scale-[1.02] transform" : ""}
                        ${isMatch ? "bg-[#ba9eff]/20 text-[#ba9eff] font-medium" : ""}
                      `}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {(!words || words.length === 0) && (
          <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
            No transcript data available.
          </div>
        )}
      </div>
    </div>
  );
}
