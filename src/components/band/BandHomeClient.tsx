"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type Ref } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import Button, { buttonClassName } from "../ui/Button";
import { RoundLink } from "../ui/RoundButton";
import NoticeCard from "../ui/NoticeCard";
import Avatar, { AvatarStack } from "../ui/Avatar";
import EmptyState from "../ui/EmptyState";
import { ListRowButton, SongRowLink } from "../ui/ListRow";
import { MenuItemButton, MenuPanel, useMenu } from "../ui/Menu";
import Shelf from "../ui/Shelf";
import { useDialog } from "../ui/DialogProvider";
import { CalendarIcon, ChevronIcon, DoneIcon, FolderIcon, GuitarIcon, InviteIcon, MoreIcon, PlusIcon } from "@/components/ui/icons";
import Badge from "../ui/Badge";
import { showDateSpokenLabel } from "./ShowDateTile";
import { BandArt, RoomCover, SongThumb } from "./BandArt";
import BandInviteSheet from "./BandInviteSheet";
import BandStartArea from "./BandStartArea";
import AttachPlaylistsSheet from "./AttachPlaylistsSheet";
import BandDateSheet from "./BandDateSheet";
import RemoveMemberModal from "./RemoveMemberModal";
import { LEFT_BAND_STORAGE_KEY } from "./LeftBandNotice";
import { BandNavigationBar } from "../playlist/NavigationBar";
import { leaveTeam, type TeamHomeMember, type TeamHomeView, type TeamRoom } from "@/actions/team";
import { track } from "@/lib/analytics";
import { aggregatePlayedSongs, formatShowDate, showDday, type PlayedSong, type ShowDday } from "@/domain/team";
import { PLAYLIST_STAGE_LABEL, playlistStage } from "@/domain/playlist-stage";
import type { MemberKey } from "@/domain/types";
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
  const [removedKeys, setRemovedKeys] = useState<MemberKey[]>([]);
  const inviteCode = rotatedCode ?? team.inviteCode;
  const nextShowAt = savedShow ? savedShow.value : team.nextShowAt;
  const members = view.members.filter((member) => !removedKeys.includes(member.memberKey));

  const [inviteOpen, setInviteOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [removing, setRemoving] = useState<{ memberKey: MemberKey; displayName: string } | null>(null);
  const membersTitleRef = useRef<HTMLHeadingElement>(null);
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
  // The bottom tabs open the running playlist, else the latest one (#106).
  const tabRoom = activeRoom ?? rooms[0] ?? null;
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
        <BandArt className="absolute inset-x-0 top-0 -z-10 h-88" />
        <div className="mx-auto max-w-md px-4 pt-4">
          <RoundLink href="/" tone="tonal" size="md" aria-label="홈으로">
            <ChevronIcon direction="left" />
          </RoundLink>

          <div className="pt-28">
            <p className="flex items-center gap-1.5 text-caption font-semibold text-white/80">
              <GuitarIcon className="h-4 w-4" />
              밴드
            </p>
            <h1 className="mt-1 line-clamp-2 break-keep text-display font-bold text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.35)]">
              {team.name}
            </h1>
            {/* DR1: in the start area the success is one quiet line, not a banner with a member count. */}
            {starting && banner === "created" && (
              <p role="status" className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
                <DoneIcon className="size-4 shrink-0" />
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
              <AvatarStack names={members.map((member) => member.displayName)} max={STACKED_AVATARS} />
            </a>
            <IconButton bare aria-label="멤버 초대" onClick={() => setInviteOpen(true)}>
              <InviteIcon className="size-6" />
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
          <NoticeCard
            role="status"
            className="mt-4"
            tone="success"
            icon={
              <DoneIcon className="size-4.5" />
            }
            title={banner === "created" ? `밴드를 만들었어요. 멤버 ${members.length}명이 함께해요` : `${team.name} 밴드에 들어왔어요`}
            onDismiss={() => setBanner(null)}
            dismissLabel="닫기"
            actions={
              banner === "created" ? (
                <Button variant="kakao" onClick={() => setInviteOpen(true)}>
                  카톡으로 알리기
                </Button>
              ) : (
                activeRoom && (
                  <Link href={`/playlist/${activeRoom.shareCode}`} className={buttonClassName({ variant: "tonal", size: "md" })}>
                    지금 플레이리스트 가기
                  </Link>
                )
              )
            }
          >
            {/* DR16: nothing to vote on yet, so say what to wait for instead of offering a button. */}
            {banner === "joined" && rooms.length === 0 && "방장이 첫 플레이리스트를 만들면 여기에 떠요"}
          </NoticeCard>
        )}

        {/* 1A: a band of one needs members before anything else. Closable; the invite icon stays. */}
        {alone && !starting && !inviteCardStoredClosed && !inviteCardClosed && (
          <NoticeCard
            className="mt-5 motion-safe:animate-fade-in"
            title={
              roomWithGuests
                ? `「${roomWithGuests.title}」 참여자 ${roomWithGuests.participantCount}명은 아직 밴드 멤버가 아니에요`
                : "멤버를 불러야 같이 투표해요"
            }
            onDismiss={dismissInviteCard}
            actions={
              <Button variant="kakao" onClick={() => setInviteOpen(true)} fullWidth>
                카톡으로 멤버 부르기
              </Button>
            }
          >
            단톡방에 초대 링크를 보내면 바로 들어와요
          </NoticeCard>
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
          <SectionTitle ref={membersTitleRef} id="band-members-title" title="멤버" count={members.length} />
          <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-5">
            {members.map((member) => (
              <MemberTile
                key={member.memberKey}
                member={member}
                onRemove={() => setRemoving({ memberKey: member.memberKey, displayName: member.displayName })}
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
                    <PlusIcon className="size-6" />
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
            <ListRowButton onClick={leave} disabled={leaving}>
              <span className="text-sm text-text-muted transition-colors group-hover/row:text-text">{leaving ? "나가는 중…" : "밴드 나가기"}</span>
            </ListRowButton>
            {leaveError && (
              <p role="alert" className="text-sm text-danger-fg">
                {leaveError}
              </p>
            )}
          </div>
        )}
      </div>

      <BandNavigationBar shareCode={tabRoom?.shareCode ?? null} />

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
          onRemoved={(memberKey, rotated) => {
            // The menu button that opened this sheet leaves with the member's tile, so the sheet has nowhere to hand
            // focus back to. Moving it now also makes the title the opener of the invite sheet below.
            membersTitleRef.current?.focus();
            setRemovedKeys((keys) => [...keys, memberKey]);
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

/** 공연 날짜: D-day 칩(눌러서 바꾸기) / 지난 공연 인사 + 다음 날짜 / 날짜 정하기. */
function ShowDateChip({ dday, onOpen }: { dday: ShowDday; onOpen: () => void }) {
  if (dday.state === "upcoming" || dday.state === "today") {
    return (
      <Button variant="tonal" pill onClick={onOpen} aria-label={showDateSpokenLabel(dday)} className="mt-4">
        <CalendarIcon className="size-4 shrink-0" />
        <span className="tabular-nums">{dday.state === "today" ? "오늘 공연" : `D-${dday.days}`}</span>
        <span className="font-normal text-text-muted">{formatShowDate(dday.date)} 공연</span>
      </Button>
    );
  }
  if (dday.state === "ended") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-text">{formatShowDate(dday.date, false)} 공연 끝 · 수고했어요</p>
        <Button variant="tonal" pill onClick={onOpen}>
          <CalendarIcon className="size-4 shrink-0" />
          다음 공연 날짜 정하기
        </Button>
      </div>
    );
  }
  return (
    <Button variant="tonal" pill onClick={onOpen} className="mt-4">
      <CalendarIcon className="size-4 shrink-0" />
      공연 날짜 정하기
    </Button>
  );
}

function StageBadge({ room }: { room: TeamRoom }) {
  const stage = playlistStage({ setlistConfirmed: room.setlistConfirmed, setlistBlockCount: room.setlistBlockCount });
  return <Badge tone="primary">{PLAYLIST_STAGE_LABEL[stage]}</Badge>;
}

/** A failed songs read leaves songCount at 0, so a zero count is left out rather than printed. */
function roomCounts(room: TeamRoom): string {
  return [
    room.setlistBlockCount > 0 && `셋리스트 ${room.setlistBlockCount}곡`,
    room.songCount > 0 && `후보곡 ${room.songCount}곡`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A card link's parts read as one accessible name; the comma lets a screen reader pause. The space stays outside the
 * sr-only span because name computation trims each element's text.
 */
function NameBreak() {
  return (
    <>
      <span className="sr-only">,</span>{" "}
    </>
  );
}

/** 지금 플레이리스트 (#80 V3): 카드 전체가 플레이리스트로 가는 링크. 단계 배지 + 제목 + 곡 수, 끝에 화살표. */
function NowRoomCard({ room }: { room: TeamRoom }) {
  const counts = roomCounts(room);
  return (
    <Card padding="none" role="region" aria-label="지금 플레이리스트" className="mt-6 transition-transform active:scale-[0.99]">
      <Link href={`/playlist/${room.shareCode}`} className="flex items-center gap-4 rounded-card p-4">
        <RoomCover thumbs={room.coverThumbs} sizes="88px" className="h-22 w-22 shrink-0" />
        <span className="min-w-0 flex-1">
          <StageBadge room={room} />
          <NameBreak />
          <span className="mt-0.5 line-clamp-2 block break-keep text-h4 font-bold text-text">{room.title}</span>
          {counts && (
            <>
              <NameBreak />
              <span className="mt-1 block text-sm text-text-muted tabular-nums">{counts}</span>
            </>
          )}
        </span>
        <ChevronIcon direction="right" className="size-5 shrink-0 text-text-subtle" />
      </Link>
    </Card>
  );
}

function SectionTitle({ id, title, count, ref }: { id: string; title: string; count: number; ref?: Ref<HTMLHeadingElement> }) {
  return (
    <h2 ref={ref} id={id} tabIndex={ref ? -1 : undefined} className="text-h3 font-bold text-text">
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
      <Shelf className="mt-4">
        <li className="w-36">
          <Link href={newRoomHref} aria-label="플레이리스트 만들기" className="group block">
            <span className="flex aspect-square w-full items-center justify-center rounded-control border-2 border-dashed border-border-strong text-text-muted transition-colors group-hover:border-text-muted group-hover:text-text">
              <PlusIcon className="size-8" />
            </span>
            <span className="mt-2 block text-sm font-semibold text-text">만들기</span>
          </Link>
        </li>
        {onAttach && (
          <li className="w-36">
            <button type="button" onClick={onAttach} className="group block w-full text-left">
              <span className="flex aspect-square w-full items-center justify-center rounded-control border-2 border-dashed border-border-strong text-text-muted transition-colors group-hover:border-text-muted group-hover:text-text">
                <FolderIcon className="size-8" />
              </span>
              <span className="mt-2 block text-sm font-semibold text-text">있던 플레이리스트 넣기</span>
            </button>
          </li>
        )}
        {rooms.map((room) => (
          <li key={room.id} className="w-36">
            <Link href={`/playlist/${room.shareCode}`} className="block">
              <RoomCover thumbs={room.coverThumbs} sizes="144px" className="aspect-square w-full" />
              <span className="mt-2 block truncate text-sm font-semibold text-text">{room.title}</span>
              <NameBreak />
              {/* A cut date reads as another day ("10월 2…"), so the date moves under a long badge instead. */}
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-text-muted tabular-nums">
                <StageBadge room={room} />
                <NameBreak />
                <span>{roomDate.format(new Date(room.createdAt))}</span>
              </span>
            </Link>
          </li>
        ))}
      </Shelf>
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
        <EmptyState size="inline" description="셋리스트를 짜면 여기에 쌓여요" />
      ) : (
        <>
          <ol className="mt-3">
            {visible.map((song) => (
              <li key={song.key}>
                <SongRowLink
                  href={`/playlist/${song.latestShareCode}`}
                  cover={<SongThumb src={song.thumbnailUrl} />}
                  trailing={song.times > 1 && <span className="text-sm font-bold text-primary-fg tabular-nums">{song.times}번</span>}
                >
                  <span className="block truncate text-body text-text">{song.title}</span>
                  {song.artist && <span className="block truncate text-sm text-text-muted">{song.artist}</span>}
                </SongRowLink>
              </li>
            ))}
          </ol>
          {!showAll && songs.length > COLLAPSED_SONGS && (
            <Button variant="tonal" size="sm" className="mt-2" onClick={() => setShowAll(true)}>
              더 보기 ({songs.length - COLLAPSED_SONGS}곡)
            </Button>
          )}
        </>
      )}
    </section>
  );
}

/** 멤버 한 칸 (YouTube Music "좋아하는 아티스트" 원). owner 에게는 내보내기 메뉴가 붙는다. */
function MemberTile({ member, onRemove }: { member: TeamHomeMember; onRemove: () => void }) {
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef, triggerRef: menuTriggerRef } = useMenu();
  const sub = member.role === "owner" ? "리더" : member.isMe ? "나" : null;
  return (
    <li className="relative flex flex-col items-center gap-2 text-center">
      <Avatar name={member.displayName} size="lg" />
      <span className="w-full min-w-0">
        <span className="block truncate text-sm text-text">{member.displayName}</span>
        {sub && (
          <span className="block text-caption text-text-muted">
            {sub}
            {member.role === "owner" && member.isMe && " · 나"}
          </span>
        )}
      </span>
      {member.canRemove && (
        <div ref={menuRef} className="absolute -right-1 -top-2 flex">
          <IconButton
            ref={menuTriggerRef}
            bare
            aria-label={`${member.displayName} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreIcon className="size-5" />
          </IconButton>
          {menuOpen && (
            <MenuPanel role="menu" className="w-36">
              <MenuItemButton
                role="menuitem"
                tone="danger"
                onClick={() => {
                  // The remove sheet hands focus back to whatever had it when it opened; the item is gone by then.
                  menuTriggerRef.current?.focus();
                  setMenuOpen(false);
                  onRemove();
                }}
              >
                내보내기
              </MenuItemButton>
            </MenuPanel>
          )}
        </div>
      )}
    </li>
  );
}
