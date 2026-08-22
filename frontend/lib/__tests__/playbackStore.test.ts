import { describe, expect, it } from "vitest";
import { usePlaybackStore } from "../../store/usePlaybackStore";

describe("usePlaybackStore", () => {
  it("starts idle", () => {
    const s = usePlaybackStore.getState();
    expect(s.currentTime).toBe(0);
    expect(s.totalDuration).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  it("updates currentTime", () => {
    usePlaybackStore.getState().setCurrentTime(12.5);
    expect(usePlaybackStore.getState().currentTime).toBe(12.5);
    usePlaybackStore.getState().setCurrentTime(0); // reset shared singleton
  });
});
