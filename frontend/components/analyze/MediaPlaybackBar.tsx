"use client";

import { usePlaybackStore } from '../../store/usePlaybackStore';

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MediaPlaybackBar() {
  const { currentTime, totalDuration: totalTime, isPlaying, togglePlay: onToggle, seekTo: onSeek } = usePlaybackStore();

  const progressPercent = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalTime <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percent * totalTime);
  };

  return (
    <div className="px-8 max-w-[1280px] mx-auto -mt-2 mb-6">
      <div
        className="rounded-3xl p-4 flex flex-col gap-3 relative glass-surface deep-boxed overflow-hidden"
      >
        <div className="flex items-center gap-4 w-full relative z-10">
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shrink-0 premium-gradient-bg glow-shadow"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <div className="flex-1 flex flex-col gap-2">
            {/* Real Progress Bar */}
            <div
              className="h-2 w-full bg-surface-container rounded-full cursor-pointer relative group overflow-hidden border border-[#e1bfb5]/50"
              onClick={handleProgressBarClick}
            >
              <div
                className="absolute inset-y-0 left-0 premium-gradient-bg rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(171,53,0,0.5)]"
                style={{ width: `${progressPercent}%` }}
              >
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-label font-bold tracking-widest text-[#594139] opacity-80">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(totalTime)}</span>
            </div>
          </div>
        </div>

        {/* Decorative Pulsing Waveform */}
        <div className="flex justify-center h-4 gap-[2px] opacity-[0.15]">
          {[40, 60, 80, 50, 90, 30, 70, 40, 60, 20, 50, 100, 40, 60, 80, 40, 60, 80].map((h, i) => (
            <div
              key={i}
              className={`w-[2px] bg-primary rounded-[1px] mx-px ${isPlaying ? 'animate-pulse' : ''}`}
              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
