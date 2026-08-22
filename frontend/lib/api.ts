// Single place for authenticated API calls: attaches the Bearer token and
// retries once through POST /auth/refresh on a 401 (AUDIT A1 step 4).

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.access_token) return false;
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...authHeaders(),
      },
    });

  let res = await doFetch();
  if (res.status === 401 && (await refreshAccessToken())) {
    res = await doFetch();
  }
  return res;
}
