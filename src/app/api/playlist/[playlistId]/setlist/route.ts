import { createAdminClient } from "@/lib/supabase/server";
import { readSetlistItems } from "@/lib/playlist-reads";
import { isUuidFormat } from "@/domain/uuid";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params;
  if (!isUuidFormat(playlistId)) return Response.json({ error: "not_found" }, { status: 404, headers });
  try {
    return Response.json(await readSetlistItems(createAdminClient(), playlistId), { headers });
  } catch (error) {
    console.error("GET /api/playlist/setlist", playlistId, (error as { code?: string }).code);
    return Response.json({ error: "read_failed" }, { status: 500, headers });
  }
}
