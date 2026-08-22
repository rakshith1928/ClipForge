import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollJobStatus } from "../pollJobStatus";

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

describe("pollJobStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("emits an update on every tick", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "transcribing", progress: 50 })));
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(updates).toEqual(["transcribing", "transcribing"]);
  });

  it("auto-stops once the job reaches done", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "done", file_id: "f1" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10000);
    expect(updates).toEqual(["done"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancel() stops polling immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    const cancel = pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(2000);
    cancel();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updates).toEqual(["queued"]);
  });

  it("ignores non-ok responses and network errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValue(jsonResponse({ status: "done" }));
    vi.stubGlobal("fetch", fetchMock);
    const updates: string[] = [];
    pollJobStatus("http://x", "j1", (u) => updates.push(u.status));
    await vi.advanceTimersByTimeAsync(6000);
    expect(updates).toEqual(["done"]);
  });
});
