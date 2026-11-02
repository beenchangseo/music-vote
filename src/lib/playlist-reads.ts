import type { createAdminClient } from "@/lib/supabase/server";
import type { Comment, SetlistItem } from "@/domain/types";

type Admin = ReturnType<typeof createAdminClient>;

type CommentRow = Omit<Comment, "isMine"> & { user_id: string | null };

/** user_id is read only to answer isMine; it stays on the server (docs/adr/0011). */
export const COMMENT_COLUMNS = "id, song_id, nickname, content, created_at, updated_at, user_id";

/** The comments as the viewer may see them: whose they are is reduced to whether they are the viewer's. */
export function commentsForViewer(rows: CommentRow[], viewerId: string | null): Comment[] {
  return rows.map(({ user_id, ...comment }) => ({ ...comment, isMine: !!viewerId && user_id === viewerId }));
}

/**
 * The setlist in play order. setlist_items is closed to the public key (v18).
 * Same tie-break as the v26 position functions, so a legacy tie draws in the order the server renumbers it.
 */
export async function readSetlistItems(admin: Admin, playlistId: string): Promise<SetlistItem[]> {
  const { data, error } = await admin
    .from("setlist_items")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data as SetlistItem[];
}

/** Every comment on the playlist's songs, oldest first. songs and comments are closed to the public key (v18). */
export async function readComments(admin: Admin, playlistId: string, viewerId: string | null): Promise<Comment[]> {
  const { data: songs, error: songsError } = await admin.from("songs").select("id").eq("playlist_id", playlistId);
  if (songsError) throw songsError;
  if (songs.length === 0) return [];

  const { data, error } = await admin
    .from("comments")
    .select(COMMENT_COLUMNS)
    .in("song_id", songs.map((song: { id: string }) => song.id))
    .order("created_at", { ascending: true });
  if (error) throw error;
  return commentsForViewer(data as CommentRow[], viewerId);
}
