import type { Comment, SetlistItem } from "@/domain/types";

/**
 * Lists the playlist screen reads again after every realtime change. They are GET routes, not Server Actions:
 * proxy counts every POST from one IP against one limit, and a band on one Wi-Fi refetching once a second
 * used it up and starved their votes too (#45).
 */
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET ${path} ${response.status}`);
  return (await response.json()) as T;
}

export function fetchSetlistItems(playlistId: string): Promise<SetlistItem[]> {
  return getJson(`/api/playlist/${playlistId}/setlist`);
}

export function fetchComments(playlistId: string): Promise<Comment[]> {
  return getJson(`/api/playlist/${playlistId}/comments`);
}
