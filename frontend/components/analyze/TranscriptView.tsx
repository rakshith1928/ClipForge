"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { usePlaybackStore } from "../../store/usePlaybackStore";

export interface Word {
  word: string;
  start: number;
  end: number;
  speaker: number;
}

export interface TranscriptViewProps {
  words: Word[];
  onSeek: (time: number) => void;
}

const TranscriptWord = React.memo(({ w, searchQuery, onSeek }: { w: Word, searchQuery: string, onSeek: (time: number) => void }) => {
  const isActive = usePlaybackStore(
    (state) => state.currentTime >= w.start && state.currentTime <= w.end
  );
  const isMatch = searchQuery && w.word.toLowerCase().includes(searchQuery.toLowerCase());

  // Using a local ref to handle scrolling without re-rendering the whole transcript container
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isActive && spanRef.current) {
      spanRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [isActive]);

  return (
    <span
      ref={spanRef}
      onClick={() => onSeek(w.start)}
      className={`
        cursor-pointer transition-all duration-200 inline-block mr-[0.3em] hover:text-primary hover:bg-primary/5 rounded px-1
        ${isActive ? "bg-primary/10 text-gradient font-bold speaker-highlight scale-[1.02] transform" : ""}
        ${isMatch ? "bg-secondary-container/20 text-secondary font-bold" : ""}
      `}
    >
      {w.word}
    </span>
  );
});

export function TranscriptView({ words, onSeek }: TranscriptViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const speakerColors = [
    "text-[#fbbf24] bg-[rgba(251,191,36,0.1)]", // Amber
    "text-[#f87171] bg-[rgba(248,113,113,0.1)]", // Coral
    "text-[#f43f5e] bg-[rgba(244,63,94,0.1)]", // Rose
    "text-primary bg-primary/10" // Primary
  ];

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[800px] glass-surface deep-boxed rounded-3xl overflow-hidden transition-all duration-500 ease-out">
      {/* Search Header */}
      <div className="p-4 border-b border-[#e1bfb5]/30 bg-[#fff8f5]/90 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <Search className="w-5 h-5 text-[#8d7168]" />
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-sm placeholder:text-[#8d7168] text-[#261911]"
        />
      </div>

      {/* Transcript Feed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar"
      >
        {groupedWords.map((group, groupIdx) => (
          <div key={groupIdx} className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded speaker-highlight uppercase tracking-widest ${speakerColors[group.speaker % speakerColors.length] || speakerColors[0]}`}>
                SPEAKER {group.speaker}
              </span>
              <div className="h-[1px] flex-1 bg-[#e1bfb5]/30"></div>
            </div>

            <div className="leading-relaxed text-[#261911] text-sm">
              {group.words.map((w) => (
                <TranscriptWord key={`${w.start}-${w.end}-${w.word}`} w={w} searchQuery={searchQuery} onSeek={onSeek} />
              ))}
            </div>
          </div>
        ))}
        {(!words || words.length === 0) && (
          <div className="flex items-center justify-center h-40 text-[#8d7168] text-sm">
            No transcript data available.
          </div>
        )}
      </div>
    </div>
  );
}
