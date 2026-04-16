export interface MediaPlaybackBarProps {
  currentTime: number; // raw seconds
  totalTime: number;   // raw seconds
  isPlaying: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MediaPlaybackBar({ 
  currentTime, 
  totalTime, 
  isPlaying, 
  onToggle, 
  onSeek 
}: MediaPlaybackBarProps) {
  const progressPercent = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalTime <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percent * totalTime);
  };

  return (
    <div className="px-6 -mt-2 mb-6">
      <div 
        className="rounded-2xl p-4 flex flex-col gap-3 relative"
        style={{
          background: "rgba(38, 37, 40, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(73, 69, 81, 0.15)",
          boxShadow: "0 0 40px -10px rgba(186, 158, 255, 0.3)"
        }}
      >
        <div className="flex items-center gap-4 w-full">
          <button 
            onClick={onToggle}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #ba9eff 0%, #8455ef 100%)" }}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          
          <div className="flex-1 flex flex-col gap-2">
            {/* Real Progress Bar */}
            <div 
              className="h-1.5 w-full bg-white/5 rounded-full cursor-pointer relative group overflow-hidden"
              onClick={handleProgressBarClick}
            >
              <div 
                className="absolute inset-y-0 left-0 bg-[#ba9eff] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_#ba9eff] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-label font-bold tracking-widest text-[#cbc4d3] opacity-60">
               <span>{formatTime(currentTime)}</span>
               <span>{formatTime(totalTime)}</span>
            </div>
          </div>
        </div>

        {/* Decorative Pulsing Waveform */}
        <div className="flex justify-center h-4 gap-[2px] opacity-20">
          {[40, 60, 80, 50, 90, 30, 70, 40, 60, 20, 50, 100, 40, 60, 80, 40, 60, 80].map((h, i) => (
            <div 
              key={i} 
              className={`w-[2px] bg-[#ba9eff] rounded-[1px] mx-[1px] ${isPlaying ? 'animate-pulse' : ''}`} 
              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
