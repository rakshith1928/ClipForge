import { create } from 'zustand';

interface PlaybackState {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;

  setCurrentTime: (time: number) => void;
  setTotalDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export const usePlaybackStore =
  create<PlaybackState>((set) => ({
    currentTime: 0,
    totalDuration: 0,
    isPlaying: false,

    setCurrentTime: (time) =>
      set({ currentTime: time }),

    setTotalDuration: (duration) =>
      set({ totalDuration: duration }),

    setIsPlaying: (isPlaying) =>
      set({ isPlaying }),
  }));
