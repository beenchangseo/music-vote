import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { readComments } from "@/lib/playlist-reads";
import { isUuidFormat } from "@/domain/uuid";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params;
  if (!isUuidFormat(playlistId)) return Response.json({ error: "not_found" }, { status: 404, headers });
  try {
    const viewer = await getCurrentUser();
    return Response.json(await readComments(createAdminClient(), playlistId, viewer?.id ?? null), { headers });
  } catch (error) {
    console.error("GET /api/playlist/comments", playlistId, (error as { code?: string }).code);
    return Response.json({ error: "read_failed" }, { status: 500, headers });
  }
}
