"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import { buttonClassName } from "./ui/Button";
import { useDialog } from "./DialogProvider";
import GuitarIcon from "./GuitarIcon";
import { showDateSpokenLabel } from "./ShowDateTile";
import { BandArt, MemberAvatar, RoomCover, SongThumb } from "./BandArt";
import BandInviteSheet, { KakaoInviteButton } from "./BandInviteSheet";
import BandStartArea from "./BandStartArea";
import AttachPlaylistsSheet from "./AttachPlaylistsSheet";
import BandDateSheet from "./BandDateSheet";
import RemoveMemberModal from "./RemoveMemberModal";
import { LEFT_BAND_STORAGE_KEY } from "./LeftBandNotice";
import { leaveTeam, type TeamHomeMember, type TeamHomeView, type TeamRoom } from "@/actions/team";
import { track } from "@/lib/analytics";
import { aggregatePlayedSongs, formatShowDate, showDday, type PlayedSong, type ShowDday } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

type MemberView = Extract<TeamHomeView, { access: "member" }>;

/** "우리가 했던 곡"은 5곡 + 더 보기 (YouTube Music Quick picks 처럼 짧게). */
const COLLAPSED_SONGS = 5;
/** 히어로 아바타 묶음에 보일 최대 인원 (나머지는 +N). */
const STACKED_AVATARS = 4;
/** 혼자인 밴드의 "멤버를 불러야" 카드를 닫았는지 (이 브라우저에서만, 밴드마다). */
const INVITE_CARD_DISMISSED_KEY = (teamId: string) => `plypick:band-invite-card-dismissed:${teamId}`;

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

const LEAVE_MESSAGE =
  "홈의 '내 밴드'와 멤버 목록에서 빠져요. 이미 들어간 플레이리스트는 그대로 남아요. 초대 링크가 있으면 다시 들어올 수 있어요.";

const roomDate = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });

interface BandHomeClientProps {
  view: MemberView;
  /** ?created=1 (방 설정이나 홈에서 만들고 왔다). 배너는 한 번만, 쿼리는 첫 마운트에 지운다 (11A·Codex 6). */
  created: boolean;
  /** ?joined=1 (초대 링크로 막 들어왔다). */
  joined: boolean;
}

/**
 * 밴드 홈 멤버 화면 (/band/[teamId]). Spotify·YouTube Music 의 아티스트·플레이리스트 화면 문법을 따른다.
 * 위에서부터 히어로(밴드 색 그림 + 이름 + 공연 날짜) / 액션 줄(멤버 아바타·초대·큰 재생 버튼) /
 * 지금 합주방 카드 / 합주방 가로 선반 / 우리가 했던 곡 / 멤버 / 맨 아래 "밴드 나가기"(owner 제외).
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
  const [attachOpen, setAttachOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [removing, setRemoving] = useState<{ userId: string; displayName: string } | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, startLeaving] = useTransition();
  // Same rule as BandPromptCard: hidden in the server render so a closed card never flashes.
  const inviteCardStoredClosed = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(INVITE_CARD_DISMISSED_KEY(team.id)) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [inviteCardClosed, setInviteCardClosed] = useState(false);

  useEffect(() => {
    if (created || joined) router.replace(`/band/${team.id}`, { scroll: false });
  }, [created, joined, router, team.id]);

  useEffect(() => {
    track("band_home_viewed", { role: myRole });
  }, [myRole]);

  function dismissInviteCard() {
    setInviteCardClosed(true);
    try {
      window.localStorage.setItem(INVITE_CARD_DISMISSED_KEY(team.id), "1");
    } catch {
      // Closed for this visit only.
    }
  }

  const played = useMemo(() => aggregatePlayedSongs(rooms), [rooms]);
  const dday = showDday(nextShowAt, new Date());
  // 1A: the latest band room whose setlist is not confirmed yet.
  const activeRoom = rooms[0] && !rooms[0].setlistConfirmed ? rooms[0] : null;
  const alone = members.length === 1;
  const newRoomHref = `/new?band=${team.id}`;
  // DR1: a band made at home starts as the owner alone with no playlist. One start area replaces
  // the created banner, the call-members card, the invite icon, "더 부르기" and the empty shelf.
  const starting = isOwner && alone && rooms.length === 0;
  // DR9: a playlist put in keeps its participants out of the band; say so on the call-members card.
  const roomWithGuests = alone ? rooms.find((room) => room.participantCount >= 2) : undefined;

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
      {/* Hero: Spotify Blend-style art in the band's own colors, the name sitting on the fade. */}
      <header className="relative isolate">
        <BandArt className="absolute inset-x-0 top-0 -z-10 h-[22rem]" />
        <div className="mx-auto max-w-md px-4 pt-4">
          <Link
            href="/"
            aria-label="홈으로"
            className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="pt-28">
            <p className="flex items-center gap-1.5 text-caption font-semibold text-white/80">
              <GuitarIcon className="h-4 w-4" />
              밴드
            </p>
            <h1 className="mt-1 line-clamp-2 break-keep text-display font-black text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.35)]">
              {team.name}
            </h1>
            {/* DR1: in the start area the success is one quiet line, not a banner with a member count. */}
            {starting && banner === "created" && (
              <p role="status" className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                밴드를 만들었어요
              </p>
            )}
            <p className="mt-2 text-sm text-text-muted tabular-nums">
              멤버 {members.length}명<Dot />
              플레이리스트 {rooms.length}개<Dot />
              했던 곡 {played.length}곡
            </p>
            <ShowDateChip dday={dday} onOpen={() => setDateOpen(true)} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-16">
        {/* Action row: Spotify Jam avatars + invite. The start area has its own invite, and the members
            section below already shows the one avatar, so the row would be a lone 32px link (FINDING-002). */}
        {!starting && (
          <div className="mt-4 flex items-center gap-1">
            <a href="#band-members" className="flex min-h-11 items-center pr-1" aria-label={`멤버 ${members.length}명`}>
              <span className="flex -space-x-2">
                {members.slice(0, STACKED_AVATARS).map((member) => (
                  <MemberAvatar
                    key={`${member.displayName}-${member.joinedAt}`}
                    name={member.displayName}
                    className="h-8 w-8 text-sm ring-2 ring-bg"
                  />
                ))}
              </span>
              {members.length > STACKED_AVATARS && (
                <span className="ml-1.5 text-sm text-text-muted tabular-nums">+{members.length - STACKED_AVATARS}</span>
              )}
            </a>
            <IconButton bare aria-label="멤버 초대" onClick={() => setInviteOpen(true)}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </IconButton>
          </div>
        )}

        {starting && (
          <BandStartArea
            newRoomHref={newRoomHref}
            onInvite={() => setInviteOpen(true)}
            attachableCount={view.attachableCount}
            onAttach={() => setAttachOpen(true)}
          />
        )}

        {banner && !starting && (
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
              {/* DR16: nothing to vote on yet, so say what to wait for instead of offering a button. */}
              {banner === "joined" && rooms.length === 0 && (
                <p className="mt-1 text-sm text-text-muted">방장이 첫 플레이리스트를 만들면 여기에 떠요</p>
              )}
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
                  지금 플레이리스트 가기
                </Link>
              )}
            </div>
            <CloseButton onClick={() => setBanner(null)} />
          </Card>
        )}

        {/* 1A: a band of one needs members before anything else. Closable; the invite icon stays. */}
        {alone && !starting && !inviteCardStoredClosed && !inviteCardClosed && (
          <Card variant="elevated" className="mt-5 motion-safe:animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-text">
                  {roomWithGuests
                    ? `「${roomWithGuests.title}」 참여자 ${roomWithGuests.participantCount}명은 아직 밴드 멤버가 아니에요`
                    : "멤버를 불러야 같이 투표해요"}
                </p>
                <p className="mt-1 text-sm text-text-muted">단톡방에 초대 링크를 보내면 바로 들어와요</p>
              </div>
              <CloseButton onClick={dismissInviteCard} />
            </div>
            <KakaoInviteButton onClick={() => setInviteOpen(true)} className="mt-4 w-full">
              카톡으로 멤버 부르기
            </KakaoInviteButton>
          </Card>
        )}

        {activeRoom && <NowRoomCard room={activeRoom} />}

        {!starting && (
          <RoomsShelf
            rooms={rooms}
            newRoomHref={newRoomHref}
            // DR8: owner only, and only when there is something to put in.
            onAttach={isOwner && (view.attachableCount ?? 0) > 0 ? () => setAttachOpen(true) : null}
          />
        )}

        {!(starting && played.length === 0) && <PlayedSongs songs={played} />}

        <section id="band-members" aria-labelledby="band-members-title" className="mt-10 scroll-mt-4">
          <SectionTitle id="band-members-title" title="멤버" count={members.length} />
          <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-5">
            {members.map((member) => (
              <MemberTile
                key={`${member.displayName}-${member.joinedAt}`}
                member={member}
                canRemove={isOwner && member.role === "member" && !!member.userId}
                onRemove={() => setRemoving({ userId: member.userId!, displayName: member.displayName })}
              />
            ))}
            {!starting && (
              <li>
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="flex w-full flex-col items-center gap-2 text-text-muted transition-colors hover:text-text"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-pill border-2 border-dashed border-border-strong">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                  <span className="text-sm">더 부르기</span>
                </button>
              </li>
            )}
          </ul>
        </section>

        {/* 디자인 2회차 1A·8A: a quiet row at the very bottom, never for the owner. */}
        {!isOwner && (
          <div className="mt-10 border-t border-border pt-2">
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
        ownerName={members.find((member) => member.role === "owner")?.displayName ?? null}
        isOwner={isOwner}
        onInviteCodeChange={setRotatedCode}
      />
      {isOwner && view.attachableCount !== null && (
        <AttachPlaylistsSheet
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          teamId={team.id}
          count={view.attachableCount}
        />
      )}
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
          onRemoved={(userId, rotated) => {
            setRemovedIds((ids) => [...ids, userId]);
            // R7: the moment the link changes is the moment to send the new one.
            if (rotated) setInviteOpen(true);
          }}
          onInviteRotated={setRotatedCode}
        />
      )}
    </main>
  );
}

function Dot() {
  return (
    <span className="mx-1.5 text-text-subtle" aria-hidden>
      ·
    </span>
  );
}

const chipClass =
  "inline-flex min-h-11 items-center gap-2 rounded-pill bg-white/10 px-4 text-sm font-semibold text-text backdrop-blur-sm transition-colors hover:bg-white/15";

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

/** 공연 날짜: D-day 칩(눌러서 바꾸기) / 지난 공연 인사 + 다음 날짜 / 날짜 정하기. */
function ShowDateChip({ dday, onOpen }: { dday: ShowDday; onOpen: () => void }) {
  if (dday.state === "upcoming" || dday.state === "today") {
    return (
      <button type="button" onClick={onOpen} aria-label={showDateSpokenLabel(dday)} className={`mt-4 ${chipClass}`}>
        <CalendarIcon />
        <span className="tabular-nums">{dday.state === "today" ? "오늘 공연" : `D-${dday.days}`}</span>
        <span className="font-normal text-text-muted">{formatShowDate(dday.date)} 공연</span>
      </button>
    );
  }
  if (dday.state === "ended") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-text">{formatShowDate(dday.date, false)} 공연 끝 · 수고했어요</p>
        <button type="button" onClick={onOpen} className={chipClass}>
          <CalendarIcon />
          다음 공연 날짜 정하기
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={`mt-4 ${chipClass}`}>
      <CalendarIcon />
      공연 날짜 정하기
    </button>
  );
}

function roomStatus(room: TeamRoom): string {
  if (room.setlist.length > 0) return `셋리스트 ${room.setlist.length}곡`;
  if (room.songCount > 0) return `투표 중 · 후보곡 ${room.songCount}곡`;
  return "투표 중";
}

/** 지금 합주방 (YouTube Music 추천 플레이리스트 카드): 커버 + 제목 + 상태 + 흰 재생 버튼. */
function NowRoomCard({ room }: { room: TeamRoom }) {
  return (
    <section aria-label="지금 플레이리스트" className="mt-6">
      <Link
        href={`/playlist/${room.shareCode}`}
        className="block overflow-hidden rounded-card bg-gradient-to-br from-primary-soft/80 via-surface to-surface p-4 ring-1 ring-white/5 transition-transform active:scale-[0.99]"
      >
        <span className="flex items-center gap-4">
          <RoomCover thumbs={room.coverThumbs} sizes="88px" className="h-22 w-22 shrink-0 shadow-lg" />
          <span className="min-w-0 flex-1">
            <span className="block text-caption font-semibold text-text-muted">지금 플레이리스트</span>
            <span className="mt-0.5 line-clamp-2 block break-keep text-h4 font-bold text-text">{room.title}</span>
            <span className="mt-1 block text-sm text-text-muted tabular-nums">{roomStatus(room)}</span>
          </span>
        </span>
        <span className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text">
            {room.setlist.length > 0 ? "셋리스트 보러 가기" : "들어가서 투표하기"}
          </span>
          <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-white text-black">
            <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
            </svg>
          </span>
        </span>
      </Link>
    </section>
  );
}

function SectionTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="text-h3 font-bold text-text">
      {title} <span className="ml-0.5 text-sm font-medium text-text-subtle tabular-nums">{count}</span>
    </h2>
  );
}

/** 합주방 가로 선반 (YouTube Music "새 앨범" 줄): 맨 앞은 새 합주방, 그다음 최근 방부터. */
function RoomsShelf({
  rooms,
  newRoomHref,
  onAttach,
}: {
  rooms: TeamRoom[];
  newRoomHref: string;
  /** "있던 플레이리스트 넣기" 타일 (DR8). null 이면 타일 없음. */
  onAttach: (() => void) | null;
}) {
  return (
    <section aria-labelledby="band-rooms" className="mt-10">
      <SectionTitle id="band-rooms" title="플레이리스트" count={rooms.length} />
      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li className="w-36 shrink-0 snap-start">
          <Link href={newRoomHref} className="group block">
            <span className="flex aspect-square w-full items-center justify-center rounded-control border-2 border-dashed border-border-strong text-text-muted transition-colors group-hover:border-text-muted group-hover:text-text">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </span>
            <span className="mt-2 block text-sm font-semibold text-text">새 플레이리스트</span>
          </Link>
        </li>
        {onAttach && (
          <li className="w-36 shrink-0 snap-start">
            <button type="button" onClick={onAttach} className="group block w-full text-left">
              <span className="flex aspect-square w-full items-center justify-center rounded-control border-2 border-dashed border-border-strong text-text-muted transition-colors group-hover:border-text-muted group-hover:text-text">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                </svg>
              </span>
              <span className="mt-2 block text-sm font-semibold text-text">있던 플레이리스트 넣기</span>
            </button>
          </li>
        )}
        {rooms.map((room) => (
          <li key={room.id} className="w-36 shrink-0 snap-start">
            <Link href={`/playlist/${room.shareCode}`} className="block">
              <RoomCover thumbs={room.coverThumbs} sizes="144px" className="aspect-square w-full" />
              <span className="mt-2 block truncate text-sm font-semibold text-text">{room.title}</span>
              <span className="block truncate text-caption text-text-muted tabular-nums">
                {roomDate.format(new Date(room.createdAt))}
                <Dot />
                {room.setlist.length > 0 ? `셋리스트 ${room.setlist.length}곡` : "투표 중"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rooms.length === 0 && <p className="mt-1 text-caption text-text-muted">새 플레이리스트를 만들면 여기에 모여요</p>}
    </section>
  );
}

/** E1 우리가 했던 곡 (YouTube Music Quick picks + Spotify Wrapped 의 "N번"). 여러 번 한 곡이 위로 온다. */
function PlayedSongs({ songs }: { songs: PlayedSong[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? songs : songs.slice(0, COLLAPSED_SONGS);
  return (
    <section aria-labelledby="band-played" className="mt-10">
      <SectionTitle id="band-played" title="우리가 했던 곡" count={songs.length} />
      {songs.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">셋리스트를 짜면 여기에 쌓여요</p>
      ) : (
        <>
          <ol className="mt-3">
            {visible.map((song) => (
              <li key={song.key}>
                <Link
                  href={`/playlist/${song.latestShareCode}`}
                  className="-mx-2 flex min-h-16 items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-hover"
                >
                  <SongThumb src={song.thumbnailUrl} className="h-12 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">{song.title}</span>
                    {song.artist && <span className="block truncate text-sm text-text-muted">{song.artist}</span>}
                  </span>
                  {song.times > 1 && (
                    <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
                      {song.times}번
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
          {!showAll && songs.length > COLLAPSED_SONGS && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              더 보기 ({songs.length - COLLAPSED_SONGS}곡)
            </button>
          )}
        </>
      )}
    </section>
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

/** 멤버 한 칸 (YouTube Music "좋아하는 아티스트" 원). owner 에게는 내보내기 메뉴가 붙는다. */
function MemberTile({
  member,
  canRemove,
  onRemove,
}: {
  member: TeamHomeMember;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sub = member.role === "owner" ? "만든 사람" : member.isMe ? "나" : null;
  return (
    <li
      className="relative flex flex-col items-center gap-2 text-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") setMenuOpen(false);
      }}
    >
      <MemberAvatar name={member.displayName} className="h-16 w-16 text-h3" />
      <span className="w-full min-w-0">
        <span className="block truncate text-sm text-text">{member.displayName}</span>
        {sub && (
          <span className="block text-caption text-text-muted">
            {sub}
            {member.role === "owner" && member.isMe && " · 나"}
          </span>
        )}
      </span>
      {canRemove && (
        <>
          <IconButton
            bare
            aria-label={`${member.displayName} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="absolute -right-1 -top-2"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="5" cy="12" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="19" cy="12" r="1.75" />
            </svg>
          </IconButton>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-10 w-36 overflow-hidden rounded-control border border-border bg-surface text-left shadow-lg"
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
        </>
      )}
    </li>
  );
}
