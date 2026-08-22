import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPosts, scheduleEpisode, updatePostStatus } from "../calendarApi";

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("fetchPosts", () => {
  it("returns the posts array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { posts: [{ id: "p1" }] } })));
    await expect(fetchPosts("http://x", "e1")).resolves.toEqual([{ id: "p1" }]);
  });

  it("throws on HTTP error with server detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "No schedulable content" }, false)));
    await expect(fetchPosts("http://x", "e1")).rejects.toThrow("No schedulable content");
  });

  it("returns [] when payload is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(fetchPosts("http://x", "e1")).resolves.toEqual([]);
  });
});

describe("scheduleEpisode", () => {
  it("resolves quietly on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(scheduleEpisode("http://x", "e1", "2026-08-22")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://x/calendar/schedule",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Episode not found" }, false)));
    await expect(scheduleEpisode("http://x", "e1", "2026-08-22")).rejects.toThrow("Episode not found");
  });
});

describe("updatePostStatus", () => {
  it("throws on HTTP error so callers can avoid optimistic lies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "bad id" }, false)));
    await expect(updatePostStatus("http://x", "p1", "posted")).rejects.toThrow("bad id");
  });
});

describe("auth headers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updatePostStatus sends the PATCH with a bearer token", async () => {
    localStorage.setItem("access_token", "cal-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await updatePostStatus("http://x", "p1", "posted");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/calendar/posts/p1/status");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer cal-token");
  });
});
