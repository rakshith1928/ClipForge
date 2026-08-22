// Calendar endpoints with strict res.ok checking (AUDIT B7: the calendar page
// previously showed success toasts even on 500s).

import { authHeaders } from "./api";

export type CalendarPost = {
  id: string;
  status: string;
  [key: string]: unknown;
};

async function detailOf(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (Array.isArray(data.detail)) return data.detail[0]?.msg || "Request failed";
    return data.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function scheduleEpisode(
  apiBase: string,
  episodeId: string,
  startDate: string
): Promise<void> {
  const res = await fetch(`${apiBase}/calendar/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ episode_id: episodeId, start_date: startDate }),
  });
  if (!res.ok) throw new Error(await detailOf(res));
}

export async function fetchPosts(apiBase: string, episodeId: string): Promise<CalendarPost[]> {
  const res = await fetch(`${apiBase}/calendar/posts/${episodeId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await detailOf(res));
  const data = await res.json();
  return data.data?.posts || [];
}

export async function updatePostStatus(
  apiBase: string,
  postId: string,
  newStatus: string
): Promise<void> {
  const res = await fetch(`${apiBase}/calendar/posts/${postId}/status?status=${newStatus}`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await detailOf(res));
}
