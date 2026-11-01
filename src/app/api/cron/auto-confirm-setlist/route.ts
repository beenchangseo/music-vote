import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Vercel Cron으로 매시간 트리거. 마감 도달했지만 셋리스트 미확정인
// 합주방을 setlist_count 기준으로 top-N 자동 확정.

interface ProcessResult {
  shareCode: string;
  playlistId: string;
  result: "confirmed" | "skipped" | "failed";
  reason?: string;
  picked?: number;
}

export async function GET(req: NextRequest) {
  // Vercel Cron auth — 프로덕션에서만 강제. 개발은 통과.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1) 자동 확정 후보 합주방
  const { data: candidates, error: candErr } = await admin
    .from("playlists")
    .select("id, share_code, setlist_count, deadline")
    .lt("deadline", nowIso)
    .gt("setlist_count", 0)
    .eq("setlist_confirmed", false);

  if (candErr) {
    return Response.json(
      { error: "candidates_fetch_failed", detail: candErr.message },
      { status: 500 },
    );
  }

  const results: ProcessResult[] = [];

  for (const pl of candidates ?? []) {
    const result = await processOne(admin, {
      id: pl.id as string,
      shareCode: pl.share_code as string,
      setlistCount: pl.setlist_count as number,
    });
    results.push(result);
  }

  return Response.json({
    ok: true,
    checkedAt: nowIso,
    candidateCount: candidates?.length ?? 0,
    results,
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function processOne(
  admin: AdminClient,
  pl: { id: string; shareCode: string; setlistCount: number },
): Promise<ProcessResult> {
  // 2) 곡 + 투표 조회
  const { data: songs, error: songsErr } = await admin
    .from("songs")
    .select("id, created_at, votes(vote_type)")
    .eq("playlist_id", pl.id);

  if (songsErr) {
    return {
      shareCode: pl.shareCode,
      playlistId: pl.id,
      result: "failed",
      reason: songsErr.message,
    };
  }

  if (!songs || songs.length === 0) {
    // 곡 0 — 확정 의미 없음. setlist_confirmed만 true로 마크해 다시 큐에 안 들어오게.
    await admin
      .from("playlists")
      .update({ setlist_confirmed: true })
      .eq("id", pl.id);
    return {
      shareCode: pl.shareCode,
      playlistId: pl.id,
      result: "skipped",
      reason: "no_songs",
    };
  }

  // 3) 점수 계산 + 정렬 (score desc, created_at asc tie-break)
  type RawSong = {
    id: string;
    created_at: string;
    votes: { vote_type: number }[] | null;
  };
  const scored = (songs as RawSong[])
    .map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      score: (s.votes ?? []).reduce(
        (acc, v) => acc + (v.vote_type === 1 ? 1 : v.vote_type === -1 ? -1 : 0),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const picked = scored.slice(0, pl.setlistCount);

  // 4) 빈 셋리면 picked 로 채우고, 블록이 있으면 사용자가 손댄 셋리 그대로 확정한다. 넣기·순서 저장과 같은 잠금 안의
  //    한 트랜잭션이다(v27).
  const { error: confirmErr } = await admin.rpc("confirm_setlist", {
    p_playlist_id: pl.id,
    p_song_ids: picked.map((s) => s.id),
  });

  if (confirmErr) {
    return {
      shareCode: pl.shareCode,
      playlistId: pl.id,
      result: "failed",
      reason: confirmErr.message,
    };
  }

  revalidatePath(`/playlist/${pl.shareCode}`);

  return {
    shareCode: pl.shareCode,
    playlistId: pl.id,
    result: "confirmed",
    picked: picked.length,
  };
}
