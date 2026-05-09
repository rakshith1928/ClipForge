import { create } from 'zustand';

interface PlaybackState {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  audioRef: HTMLAudioElement | null;
  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAudioRef: (ref: HTMLAudioElement | null) => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTime: 0,
  totalDuration: 0,
  isPlaying: false,
  audioRef: null,
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setTotalDuration: (duration) => set({ totalDuration: duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setAudioRef: (ref) => set({ audioRef: ref }),
  
  togglePlay: () => {
    const { audioRef, isPlaying } = get();
    if (!audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
      set({ isPlaying: false });
    } else {
      audioRef.play().then(() => {
        set({ isPlaying: true });
      }).catch(e => console.error("Playback failed", e));
    }
  },
  
  seekTo: (time: number) => {
    const { audioRef } = get();
    if (audioRef) {
      audioRef.currentTime = time;
    }
    set({ currentTime: time });
  }
}));
