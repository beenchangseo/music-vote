import { createAdminClient } from "@/lib/supabase/server";
import { readComments } from "@/lib/playlist-reads";

export async function GET(_request: Request, { params }: { params: Promise<{ playlistId: string }> }) {
  const { playlistId } = await params;
  try {
    return Response.json(await readComments(createAdminClient(), playlistId));
  } catch (error) {
    console.error("GET /api/playlist/comments", playlistId, (error as { code?: string }).code);
    return Response.json({ error: "read_failed" }, { status: 500 });
  }
}
