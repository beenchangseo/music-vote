"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import { buttonClassName } from "./ui/Button";
import { useDialog } from "./DialogProvider";
import ShowDateTile from "./ShowDateTile";
import BandInviteSheet, { KakaoInviteButton } from "./BandInviteSheet";
import BandDateSheet from "./BandDateSheet";
import RemoveMemberModal from "./RemoveMemberModal";
import { LEFT_BAND_STORAGE_KEY } from "./LeftBandNotice";
import { leaveTeam, type TeamHomeMember, type TeamHomeView, type TeamRoom } from "@/actions/team";
import { track } from "@/lib/analytics";
import { formatShowDate, showDday } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

type MemberView = Extract<TeamHomeView, { access: "member" }>;

/** 합주방 목록은 최근 5개 + 더 보기 (CEO Section 4, MyPlaylists 와 같은 패턴). */
const COLLAPSED_ROOMS = 5;

const LEAVE_MESSAGE =
  "홈의 '내 밴드'와 멤버 목록에서 빠져요. 이미 들어간 합주방은 그대로 남아요. 초대 링크가 있으면 다시 들어올 수 있어요.";

const roomDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });

interface BandHomeClientProps {
  view: MemberView;
  /** ?created=1 (방 설정에서 만들고 왔다). 배너는 한 번만, 쿼리는 첫 마운트에 지운다 (11A·Codex 6). */
  created: boolean;
  /** ?joined=1 (초대 링크로 막 들어왔다). */
  joined: boolean;
}

/**
 * 밴드 홈 멤버 화면 (/band/[teamId]). 위에서부터 툴바(뒤로·초대) / 밴드 이름 + 공연 날짜 타일 /
 * 상태별 주 버튼(1A) / 합주방 한 목록(26A, 펼치면 E1 곡 기록) / 멤버 / 맨 아래 "밴드 나가기"(owner 제외).
 */
export default function BandHomeClient({ view, created, joined }: BandHomeClientProps) {
  const router = useRouter();
  const { showDanger } = useDialog();
  const { team, myRole, rooms } = view;
  const isOwner = myRole === "owner";

  const [banner, setBanner] = useState<"created" | "joined" | null>(
    created ? "created" : joined ? "joined" : null,
  );
  // Values the server will also send after revalidation; kept locally so the screen updates at once.
  const [rotatedCode, setRotatedCode] = useState<string | null>(null);
  const [savedShow, setSavedShow] = useState<{ value: string | null } | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const inviteCode = rotatedCode ?? team.inviteCode;
  const nextShowAt = savedShow ? savedShow.value : team.nextShowAt;
  const members = view.members.filter((member) => !member.userId || !removedIds.includes(member.userId));

  const [inviteOpen, setInviteOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [removing, setRemoving] = useState<{ userId: string; displayName: string } | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, startLeaving] = useTransition();

  useEffect(() => {
    if (created || joined) router.replace(`/band/${team.id}`, { scroll: false });
  }, [created, joined, router, team.id]);

  useEffect(() => {
    track("band_home_viewed", { role: myRole });
  }, [myRole]);

  const dday = showDday(nextShowAt, new Date());
  // 1A: the latest band room whose setlist is not confirmed yet.
  const activeRoom = rooms[0] && !rooms[0].setlistConfirmed ? rooms[0] : null;
  const alone = members.length <= 1;
  const newRoomHref = `/new?band=${team.id}`;

  async function leave() {
    const ok = await showDanger(LEAVE_MESSAGE, { title: `${team.name}에서 나갈까요?`, confirmLabel: "나가기" });
    if (!ok) return;
    setLeaveError(null);
    startLeaving(async () => {
      let result: Awaited<ReturnType<typeof leaveTeam>>;
      try {
        result = await leaveTeam(team.id);
      } catch {
        result = { success: false, reason: "write_failed" };
      }
      if (!result.success) {
        setLeaveError(teamMessage(result.reason));
        return;
      }
      try {
        window.sessionStorage.setItem(LEFT_BAND_STORAGE_KEY, team.name);
      } catch {
        // Home falls back to "밴드에서 나왔어요".
      }
      router.push("/?left=1");
    });
  }

  return (
    <main className="min-h-full bg-bg">
      <div className="mx-auto max-w-md px-4 py-6 pb-16">
        {/* Right padding keeps the share icon clear of the fixed account button on phones. */}
        <div className="flex items-center justify-between pr-12 sm:pr-0">
          <Link
            href="/"
            aria-label="홈으로"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <IconButton aria-label="멤버 초대" onClick={() => setInviteOpen(true)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M12 15V2.25m0 0l-3 3m3-3l3 3" />
            </svg>
          </IconButton>
        </div>

        {banner && (
          <Card role="status" className="mt-4 flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                {banner === "created"
                  ? `밴드를 만들었어요. 멤버 ${members.length}명이 함께해요`
                  : `${team.name} 밴드에 들어왔어요`}
              </p>
              {banner === "created" && (
                <KakaoInviteButton onClick={() => setInviteOpen(true)} className="mt-3">
                  카톡으로 알리기
                </KakaoInviteButton>
              )}
              {banner === "joined" && activeRoom && (
                <Link
                  href={`/playlist/${activeRoom.shareCode}`}
                  className={buttonClassName({ variant: "secondary", size: "md", className: "mt-3" })}
                >
                  지금 합주방 가기
                </Link>
              )}
            </div>
            <CloseButton onClick={() => setBanner(null)} />
          </Card>
        )}

        <h1 className="mt-4 truncate text-h2 font-bold text-text">{team.name}</h1>

        <div className="mt-3">
          {dday.state === "upcoming" || dday.state === "today" ? (
            <ShowDateTile dday={dday} onClick={() => setDateOpen(true)} />
          ) : dday.state === "ended" ? (
            <Card variant="elevated">
              <p className="text-body font-semibold text-text">{formatShowDate(dday.date, false)} 공연 끝 · 수고했어요</p>
              <button
                type="button"
                onClick={() => setDateOpen(true)}
                className={buttonClassName({ variant: "secondary", size: "md", className: "mt-3" })}
              >
                다음 공연 날짜 정하기
              </button>
            </Card>
          ) : (
            <Card variant="outline" padding="none">
              <button
                type="button"
                onClick={() => setDateOpen(true)}
                className="flex min-h-14 w-full items-center gap-3 rounded-card px-4 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                공연 날짜 정하기
              </button>
            </Card>
          )}
        </div>

        {/* 1A: one primary action by state. */}
        <div className="mt-4 space-y-2">
          {alone ? (
            <>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className={buttonClassName({ size: "lg", fullWidth: true })}
              >
                카톡으로 멤버 부르기
              </button>
              <Link href={newRoomHref} className={buttonClassName({ variant: "secondary", size: "md", fullWidth: true })}>
                새 합주방
              </Link>
            </>
          ) : activeRoom ? (
            <>
              <Link
                href={`/playlist/${activeRoom.shareCode}`}
                className="flex min-h-16 items-center gap-3 rounded-control bg-primary px-4 py-3 text-white transition-all hover:bg-primary-hover active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-caption text-white/80">지금 합주방</span>
                  <span className="block truncate text-body font-semibold">{activeRoom.title}</span>
                </span>
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href={newRoomHref} className={buttonClassName({ variant: "secondary", size: "md", fullWidth: true })}>
                새 합주방
              </Link>
            </>
          ) : (
            <Link href={newRoomHref} className={buttonClassName({ size: "lg", fullWidth: true })}>
              새 합주방
            </Link>
          )}
        </div>

        <RoomsSection rooms={rooms} />

        <section aria-labelledby="band-members" className="mt-8">
          <SectionTitle id="band-members" title="멤버" count={members.length} />
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {members.map((member) => (
              <MemberRow
                key={`${member.displayName}-${member.joinedAt}`}
                member={member}
                canRemove={isOwner && member.role === "member" && !!member.userId}
                onRemove={() => setRemoving({ userId: member.userId!, displayName: member.displayName })}
              />
            ))}
          </ul>
        </section>

        {/* 디자인 2회차 1A·8A: a quiet row at the very bottom, never for the owner. */}
        {!isOwner && (
          <div className="mt-8 border-t border-border pt-2">
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="inline-flex min-h-11 items-center text-sm text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              {leaving ? "나가는 중…" : "밴드 나가기"}
            </button>
            {leaveError && (
              <p role="alert" className="text-sm text-danger">
                {leaveError}
              </p>
            )}
          </div>
        )}
      </div>

      <BandInviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        teamId={team.id}
        name={team.name}
        inviteCode={inviteCode}
        memberCount={members.length}
        nextShowAt={nextShowAt}
        isOwner={isOwner}
        onInviteCodeChange={setRotatedCode}
      />
      <BandDateSheet
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        teamId={team.id}
        nextShowAt={nextShowAt}
        onSaved={(value) => setSavedShow({ value })}
      />
      {isOwner && (
        <RemoveMemberModal
          teamId={team.id}
          member={removing}
          onClose={() => setRemoving(null)}
          onRemoved={(userId) => setRemovedIds((ids) => [...ids, userId])}
          onInviteRotated={(code) => {
            setRotatedCode(code);
            // R7: the moment the link changes is the moment to send the new one.
            setInviteOpen(true);
          }}
        />
      )}
    </main>
  );
}

function SectionTitle({ id, title, count, sub }: { id: string; title: string; count: number; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-h4 font-semibold text-text">
        {title} <span className="text-sm font-normal text-text-subtle tabular-nums">{count}</span>
      </h2>
      {sub && <p className="text-sm text-text-subtle tabular-nums">{sub}</p>}
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton bare aria-label="닫기" onClick={onClick} className="-my-2 -mr-2">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </IconButton>
  );
}

/** 26A: one list of band rooms. A row with a setlist expands into the songs played (E1). */
function RoomsSection({ rooms }: { rooms: TeamRoom[] }) {
  const [showAll, setShowAll] = useState(false);
  // Only the latest room starts open.
  const [expanded, setExpanded] = useState<string[]>(() =>
    rooms[0] && rooms[0].setlist.length > 0 ? [rooms[0].id] : [],
  );
  const songTotal = rooms.reduce((sum, room) => sum + room.setlist.length, 0);
  const visible = showAll ? rooms : rooms.slice(0, COLLAPSED_ROOMS);

  function toggle(id: string) {
    setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <section aria-labelledby="band-rooms" className="mt-8">
      <SectionTitle id="band-rooms" title="합주방" count={rooms.length} sub={`했던 곡 ${songTotal}`} />
      {rooms.length === 0 ? (
        <Card variant="outline" className="mt-3 text-center">
          <p className="text-sm text-text-muted">아직 합주방이 없어요. 새 합주방을 만들면 여기에 모여요</p>
        </Card>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {visible.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                expanded={expanded.includes(room.id)}
                onToggle={() => toggle(room.id)}
              />
            ))}
          </ul>
          {songTotal === 0 && <p className="mt-2 text-caption text-text-muted">셋리스트를 짜면 여기에 쌓여요</p>}
          {!showAll && rooms.length > COLLAPSED_ROOMS && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center text-sm text-text-muted transition-colors hover:text-text"
            >
              더 보기 ({rooms.length - COLLAPSED_ROOMS}개)
            </button>
          )}
        </>
      )}
    </section>
  );
}

function RoomRow({ room, expanded, onToggle }: { room: TeamRoom; expanded: boolean; onToggle: () => void }) {
  const hasSetlist = room.setlist.length > 0;
  const listId = `room-songs-${room.id}`;
  return (
    <li>
      <div className="flex min-h-14 items-center gap-2">
        <Link href={`/playlist/${room.shareCode}`} className="min-w-0 flex-1 py-2">
          <span className="block truncate text-body text-text">{room.title}</span>
          <span className="block text-caption text-text-muted tabular-nums">
            {roomDate.format(new Date(room.createdAt))}
            <span className="mx-1.5 text-text-subtle" aria-hidden>·</span>
            {hasSetlist ? `셋리스트 ${room.setlist.length}곡` : "투표 중"}
          </span>
        </Link>
        {hasSetlist && (
          <IconButton
            bare
            aria-label={`${room.title} 곡 기록 ${expanded ? "접기" : "펼치기"}`}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={onToggle}
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </IconButton>
        )}
      </div>
      {hasSetlist && expanded && (
        <ol id={listId} className="space-y-1 pb-3">
          {room.setlist.map((song, index) => (
            <li key={`${song.songId}-${song.position}`} className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="w-5 shrink-0 text-right text-caption text-text-subtle tabular-nums">{index + 1}</span>
              <span className="truncate text-text">{song.title}</span>
              {song.artist && <span className="shrink-0 truncate text-caption text-text-muted">{song.artist}</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function MemberRow({
  member,
  canRemove,
  onRemove,
}: {
  member: TeamHomeMember;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li className="flex min-h-14 items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-body text-text">
        {member.displayName}
        {member.isMe && <span className="ml-1.5 text-caption text-text-muted">나</span>}
      </p>
      {member.role === "owner" && <span className="shrink-0 text-caption text-text-muted">만든 사람</span>}
      {canRemove && (
        <div
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenuOpen(false);
          }}
        >
          <IconButton
            bare
            aria-label={`${member.displayName} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </IconButton>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-10 w-36 overflow-hidden rounded-control border border-border bg-surface shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="flex min-h-11 w-full items-center px-4 text-sm text-danger transition-colors hover:bg-surface-hover"
              >
                내보내기
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
