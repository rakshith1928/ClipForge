import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, authHeaders, getAccessToken } from "../api";

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.setItem("access_token", "stale-token");
    localStorage.setItem("refresh_token", "valid-refresh");
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("attaches the Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://x/api");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer stale-token");
  });

  it("retries once with a fresh token after refreshing on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401)) // original -> 401
      .mockResolvedValueOnce(                       // refresh succeeds
        jsonResponse({ access_token: "fresh-token" })
      )
      .mockResolvedValueOnce(jsonResponse({ done: true })); // retry OK
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("http://x/api");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem("access_token")).toBe("fresh-token");
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(retryInit.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("does not retry when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: "bad" }, 401)); // refresh fails
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("http://x/api");
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not attach a header when logged out", async () => {
    localStorage.removeItem("access_token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://x/api");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe("helpers", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("getAccessToken reads localStorage", () => {
    localStorage.setItem("access_token", "tok");
    expect(getAccessToken()).toBe("tok");
  });

  it("authHeaders is empty without a token", () => {
    localStorage.removeItem("access_token");
    expect(authHeaders()).toEqual({});
  });
});
