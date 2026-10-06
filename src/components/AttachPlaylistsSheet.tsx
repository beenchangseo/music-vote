"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { RoomCover } from "./BandArt";
import { attachPlaylistToTeam, getAttachablePlaylists, type AttachablePlaylist } from "@/actions/team";
import { track } from "@/lib/analytics";
import { teamMessage } from "@/lib/team-messages";

const roomDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });

type RowState = { status: "idle" } | { status: "pending" } | { status: "done" } | { status: "failed"; message: string };

interface AttachPlaylistsSheetProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  /** 밴드 홈이 미리 센 수. 제목에 고정한다 (DR8). */
  count: number;
}

/**
 * 밴드 홈 "있던 플레이리스트 넣기" (CEO2-E, DR8 · DR9). 목록은 시트를 열 때 읽는다.
 * 행마다 바로 넣고 시트는 열린 채로 둔다(연속 넣기). 실패는 그 행 아래에, 다 넣으면 "모두 넣었어요".
 * 닫을 때 하나라도 넣었으면 밴드 홈을 다시 읽는다.
 */
export default function AttachPlaylistsSheet({ open, onClose, teamId, count }: AttachPlaylistsSheetProps) {
  const router = useRouter();
  const [attachedAny, setAttachedAny] = useState(false);

  function close() {
    onClose();
    if (attachedAny) {
      setAttachedAny(false);
      router.refresh();
    }
  }

  return (
    <Modal open={open} onClose={close} title={`있던 플레이리스트 넣기 · ${count}개`}>
      <SheetBody teamId={teamId} onAttached={() => setAttachedAny(true)} onClose={close} />
    </Modal>
  );
}

function SheetBody({ teamId, onAttached, onClose }: { teamId: string; onAttached: () => void; onClose: () => void }) {
  const [list, setList] = useState<AttachablePlaylist[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    getAttachablePlaylists(teamId)
      .then((result) => {
        if (!active) return;
        if (result.success) setList(result.playlists);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [teamId, attempt]);

  async function attach(playlist: AttachablePlaylist) {
    setRows((current) => ({ ...current, [playlist.id]: { status: "pending" } }));
    let message: string | null = null;
    try {
      const result = await attachPlaylistToTeam(playlist.id, teamId);
      if (!result.success) message = teamMessage(result.reason);
    } catch (caught) {
      message = teamMessage(caught);
    }
    if (message) {
      setRows((current) => ({ ...current, [playlist.id]: { status: "failed", message } }));
      setAnnouncement(`「${playlist.title}」을 넣지 못했어요`);
      return;
    }
    track("team_created", { source: "attach" });
    onAttached();
    setRows((current) => ({ ...current, [playlist.id]: { status: "done" } }));
    setAnnouncement(`「${playlist.title}」을 넣었어요`);
  }

  const allDone = !!list && list.length > 0 && list.every((playlist) => rows[playlist.id]?.status === "done");

  return (
    <div>
      {/* DR9: putting a playlist in does not make its participants members. */}
      <p className="-mt-2 mb-4 text-sm text-text-muted">넣어도 참여자는 밴드 멤버가 되지 않아요</p>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {loadFailed ? (
        <div className="rounded-control border border-border bg-surface p-4">
          <p className="text-sm text-text">목록을 불러오지 못했어요</p>
          <Button
            variant="secondary"
            className="mt-3 min-h-11"
            onClick={() => {
              setLoadFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            다시 불러오기
          </Button>
        </div>
      ) : list === null ? (
        <ul aria-busy="true" aria-label="플레이리스트를 불러오는 중" className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 motion-safe:animate-pulse-soft">
              <span className="h-14 w-14 shrink-0 rounded-control bg-surface" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/3 rounded bg-surface" />
                <span className="block h-3 w-1/3 rounded bg-surface" />
              </span>
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <p className="text-sm text-text-muted">넣을 플레이리스트가 없어요</p>
      ) : (
        <>
          <ul className="space-y-3">
            {list.map((playlist) => {
              const row = rows[playlist.id] ?? { status: "idle" };
              return (
                <li key={playlist.id}>
                  <div className="flex items-center gap-3">
                    <RoomCover thumbs={playlist.coverThumbs} sizes="56px" className="h-14 w-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-keep text-sm font-semibold text-text">{playlist.title}</p>
                      <p className="mt-0.5 text-caption text-text-muted tabular-nums">
                        참여자 {playlist.participantCount}명 · {roomDate.format(new Date(playlist.createdAt))}
                      </p>
                    </div>
                    {row.status === "done" ? (
                      <span className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-success">넣었어요 ✓</span>
                    ) : (
                      <Button
                        variant="secondary"
                        className="min-h-11 shrink-0"
                        loading={row.status === "pending"}
                        onClick={() => attach(playlist)}
                        aria-label={`「${playlist.title}」 ${row.status === "failed" ? "다시 넣기" : "넣기"}`}
                      >
                        {row.status === "failed" ? "다시 넣기" : "넣기"}
                      </Button>
                    )}
                  </div>
                  {row.status === "failed" && <p className="mt-1.5 text-sm text-danger">{row.message}</p>}
                </li>
              );
            })}
          </ul>
          {allDone && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-text">모두 넣었어요</p>
              <Button size="lg" fullWidth className="mt-3" onClick={onClose}>
                닫기
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
