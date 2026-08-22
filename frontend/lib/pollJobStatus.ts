// Polls /upload/status/{jobId} until the job reaches a terminal state.
// Returns a cancel() function so callers can clean up on unmount (AUDIT B6).

import { authHeaders } from "./api";

export type JobStatusUpdate = {
  status: string;
  progress?: number;
  transcript?: string;
  file_id?: string;
  error?: string;
};

export function pollJobStatus(
  apiBase: string,
  jobId: string,
  onUpdate: (update: JobStatusUpdate) => void,
  intervalMs = 2000
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  timer = setInterval(async () => {
    try {
      const res = await fetch(`${apiBase}/upload/status/${jobId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return; // wait for next tick
      const data: JobStatusUpdate = await res.json();
      onUpdate(data);
      if (data.status === "done" || data.status === "error") stop();
    } catch {
      // network hiccup during polling — retry next tick
    }
  }, intervalMs);

  return stop;
}
