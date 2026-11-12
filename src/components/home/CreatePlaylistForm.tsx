"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDialog } from "../ui/DialogProvider";
import { createPlaylist } from "@/actions/playlist";
import { attachPlaylistToTeam, createBandPlaylist, type MyTeam } from "@/actions/team";
import { track } from "@/lib/analytics";
import { teamMessage } from "@/lib/team-messages";
import KakaoShareButton from "../share/KakaoShareButton";
import { CalendarIcon, CloseIcon, DoneIcon, GuitarIcon, LinkIcon, MinusIcon, PlusIcon, QrCodeIcon, SetlistIcon } from "@/components/ui/icons";
import Button from "../ui/Button";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import Input from "../ui/Input";
import { ListRowIcon } from "../ui/ListRow";
import SegmentedControl, { type SegmentOption } from "../ui/SegmentedControl";
import Switch from "../ui/Switch";
import type { VotingMode } from "@/domain/types";

const VOTING_MODE_OPTIONS: readonly SegmentOption<VotingMode>[] = [
  { value: "free", label: "자유 투표" },
  { value: "allocated", label: "투표권 할당" },
];

interface CreatedPlaylist {
  id: string;
  shareCode: string;
  adminToken: string;
  title: string;
  url: string;
  /** 밴드 안에 만들었으면 그 밴드 (?band= 또는 DR12 토글). */
  band: { id: string; name: string; nextShowAt: string | null } | null;
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CreatePlaylistFormProps {
  /** /new?band={teamId} 로 왔고 그 밴드 멤버일 때. 방은 createBandPlaylist 로 밴드 안에 만든다. */
  band?: { id: string; name: string; nextShowAt: string | null } | null;
  /**
   * 내 밴드. 1개면 "{밴드}에 만들기" 토글을 켠 채 보인다(DR12). 2개 이상이면 완료 화면에서 넣을 후보(13A).
   */
  myTeams?: MyTeam[];
}

export default function CreatePlaylistForm({ band = null, myTeams = [] }: CreatePlaylistFormProps) {
  const [title, setTitle] = useState("");
  // DR12: with exactly one band (and no ?band=), make it there by default; turning it off makes it outside.
  const soleTeam = !band && myTeams.length === 1 ? myTeams[0] : null;
  const [inSoleTeam, setInSoleTeam] = useState(true);
  const targetBand = band ?? (soleTeam && inSoleTeam ? soleTeam : null);
  // Band path only: createBandPlaylist returns a reason instead of throwing (6A, text under the button).
  const [formError, setFormError] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [setlistCount, setSetlistCount] = useState(0);
  const [votingMode, setVotingMode] = useState<VotingMode>("free");
  const [defaultVoteLimit, setDefaultVoteLimit] = useState(3);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedPlaylist | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const { showAlert } = useDialog();
  const router = useRouter();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const todayStr = useMemo(() => getTodayString(), []);

  const deadlineISO = useMemo(() => {
    if (!deadlineDate) return "";
    const [year, month, day] = deadlineDate.split("-").map(Number);
    const [hour, minute] = deadlineTime.split(":").map(Number);
    const d = new Date(year, month - 1, day, hour, minute, 0);
    return d.toISOString();
  }, [deadlineDate, deadlineTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    setFormError(null);
    try {
      let result: { id: string; shareCode: string; adminToken: string };
      if (targetBand) {
        const created = await createBandPlaylist(
          targetBand.id,
          title.trim(),
          deadlineISO || undefined,
          setlistCount > 0 ? setlistCount : undefined,
          votingMode,
          defaultVoteLimit,
        );
        if (!created.success) {
          setFormError(teamMessage(created.reason));
          setLoading(false);
          return;
        }
        result = created;
        track("team_playlist_created", { has_next_show: !!targetBand.nextShowAt });
      } else {
        result = await createPlaylist(
          title.trim(),
          deadlineISO || undefined,
          setlistCount > 0 ? setlistCount : undefined,
          votingMode,
          defaultVoteLimit,
        );
      }

      track("playlist_created", {
        has_deadline: !!deadlineISO,
        setlist_count: setlistCount,
      });

      let myPlaylists = [];
      try { myPlaylists = JSON.parse(localStorage.getItem("myPlaylists") || "[]"); } catch { /* ignore */ }
      if (!Array.isArray(myPlaylists)) myPlaylists = [];
      myPlaylists.push({
        id: result.id,
        shareCode: result.shareCode,
        adminToken: result.adminToken,
        title: title.trim(),
      });
      try { localStorage.setItem("myPlaylists", JSON.stringify(myPlaylists)); } catch { /* quota */ }

      const url = `${window.location.origin}/playlist/${result.shareCode}`;
      setCreated({
        id: result.id,
        shareCode: result.shareCode,
        adminToken: result.adminToken,
        title: title.trim(),
        url,
        band: targetBand ? { id: targetBand.id, name: targetBand.name, nextShowAt: targetBand.nextShowAt } : null,
      });
    } catch (error) {
      if (targetBand) setFormError(teamMessage(error));
      else showAlert("플레이리스트를 만들지 못했어요. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      showAlert(`링크 복사에 실패했어요. 직접 복사해주세요:\n${created.url}`);
    }
  }

  function handleGoToPlaylist() {
    if (!created) return;
    router.push(`/playlist/${created.shareCode}`);
  }

  /** 13A: a room made without ?band= can join one of my bands right from the completion screen. */
  async function attachToBand(teamId: string) {
    if (!created) return;
    setAttachingId(teamId);
    setAttachError(null);
    try {
      const result = await attachPlaylistToTeam(created.id, teamId);
      if (!result.success) {
        setAttachError(teamMessage(result.reason));
        return;
      }
      track("team_created", { source: "attach" });
      setAttached(true);
    } catch (error) {
      setAttachError(teamMessage(error));
    } finally {
      setAttachingId(null);
    }
  }

  // Success screen — QR + URL + go-to-playlist
  if (created) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(created.url)}&bgcolor=111827&color=ffffff`;

    return (
      <div className="w-full max-w-md mx-auto animate-fade-in">
        {/* Outline, not filled: the form sits on a surface sheet at home and on bg at /new, and the tonal and
            QR fills inside have to stay one step above either. */}
        <Card variant="outline" padding="lg" className="text-center">
          <div className="size-12 mx-auto mb-4 rounded-pill bg-success-tint flex items-center justify-center">
            <DoneIcon className="size-6 text-success" />
          </div>

          <h2 className="text-h3 font-bold text-text mb-1">{created.title}</h2>
          <p className="text-sm text-text-muted mb-6">
            만들었어요. 단톡방에 바로 공유해보세요.
          </p>

          {/* Primary CTA — Kakao share. A band room carries the show date in front (25A). */}
          <KakaoShareButton
            shareCode={created.shareCode}
            variant="playlist"
            title={created.title}
            showDate={created.band?.nextShowAt ?? null}
            size="lg"
            className="w-full mb-2"
          >
            카카오톡으로 공유
          </KakaoShareButton>

          {/* Secondary CTA — go add songs */}
          <Button variant="tonal" fullWidth onClick={handleGoToPlaylist}>
            곡 추가하러 가기
          </Button>

          {/* Tertiary — small ghost buttons */}
          <div className="flex items-center justify-center gap-1 mt-3">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <LinkIcon className="size-4" />
              {copied ? "복사됨" : "링크 복사"}
            </Button>
            <span className="text-text-subtle" aria-hidden>·</span>
            <Button variant="ghost" size="sm" onClick={() => setShowQR((v) => !v)} aria-expanded={showQR}>
              <QrCodeIcon className="size-4" />
              QR 코드 {showQR ? "숨기기" : "보기"}
            </Button>
          </div>

          {showQR && (
            <div className="mt-3 animate-fade-in">
              <div className="bg-surface-hover rounded-control p-3 inline-block">
                <Image
                  src={qrUrl}
                  alt="QR 코드"
                  width={160}
                  height={160}
                  className="mx-auto"
                  unoptimized
                />
              </div>
              <p className="text-caption text-text-subtle mt-2">
                합주실에서 멤버 화면으로 보여주세요
              </p>
            </div>
          )}

          {/* 13A for two or more bands. With one, the choice was the toggle and is not asked again (eng E3). */}
          {!created.band && myTeams.length >= 2 && (
            <div className="mt-5 border-t border-border pt-4 text-left">
              {attached ? (
                <p role="status" className="text-sm text-success">
                  밴드에 넣었어요
                </p>
              ) : (
                <>
                  <p className="text-sm text-text">이 플레이리스트를 밴드에 넣을까요?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {myTeams.map((team) => (
                      <Button
                        key={team.id}
                        type="button"
                        variant="tonal"
                        loading={attachingId === team.id}
                        disabled={attachingId !== null}
                        onClick={() => attachToBand(team.id)}
                      >
                        <span className="flex min-w-0"><span className="truncate">{team.name}</span>에 넣기</span>
                      </Button>
                    ))}
                  </div>
                  {attachError && (
                    <p role="alert" className="mt-2 text-sm text-danger-fg">
                      {attachError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Creation form
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <Input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="어떤 합주예요? (예: 4월 정기 합주)"
        maxLength={100}
      />

      {/* DR12: the whole 44px row toggles. */}
      {soleTeam && (
        <Switch
          className="mt-2"
          icon={<GuitarIcon className="size-4" />}
          label={<span className="block truncate">{soleTeam.name}에 만들기</span>}
          checked={inSoleTeam}
          onCheckedChange={setInSoleTeam}
        />
      )}

      <Button type="submit" size="lg" fullWidth className="mt-3" disabled={!title.trim()} loading={loading}>
        플레이리스트 만들기
      </Button>
      {formError && (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          {formError}
        </p>
      )}

      {/* Options toggle — collapsed by default */}
      {!showOptions ? (
        <Button type="button" variant="ghost" fullWidth className="mt-3" onClick={() => setShowOptions(true)}>
          <PlusIcon className="size-4" />
          옵션 추가 (투표 방식 · 마감일 · 곡 수)
        </Button>
      ) : (
      /* Options card. Outline for the same reason as the success card. */
      <Card variant="outline" padding="none" className="mt-4 overflow-hidden animate-fade-in">
        <div className="pl-4 pr-1 pt-2 pb-1 flex items-center justify-between">
          <p className="text-caption text-text-subtle font-semibold">옵션</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setShowOptions(false); setDeadlineDate(""); setDeadlineTime("23:59"); setSetlistCount(0); }}
          >
            닫기
          </Button>
        </div>

        <div className="border-t border-border px-4 py-3">
        <p id="voting-mode-label" className="text-sm font-semibold text-text">투표 방식</p>
        <p className="mt-1 text-caption text-text-muted">
          플레이리스트를 만든 뒤에도 투표가 시작되기 전에는 바꿀 수 있어요
        </p>
        <SegmentedControl
          aria-labelledby="voting-mode-label"
          className="mt-3"
          options={VOTING_MODE_OPTIONS}
          value={votingMode}
          onChange={setVotingMode}
        />
        {votingMode === "allocated" && (
          <div className="mt-3 flex items-center justify-between gap-3 animate-fade-in">
            <div>
              <label htmlFor="default-vote-limit" className="text-sm font-medium text-text">
                기본 투표권
              </label>
              <p className="text-caption text-text-muted">새 참여자가 받는 표 수예요</p>
            </div>
            <div className="w-20 shrink-0">
              <Input
                id="default-vote-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                step={1}
                value={defaultVoteLimit}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value)) setDefaultVoteLimit(Math.min(99, Math.max(1, value)));
                }}
                className="text-center"
              />
            </div>
          </div>
        )}
        </div>

        {/* 투표 마감일 */}
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <ListRowIcon className="shrink-0 mt-0.5 text-primary-fg">
              <CalendarIcon className="size-5" />
            </ListRowIcon>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-text font-medium text-left">투표 마감일</label>
              <p className="text-caption text-text-muted mt-0.5 mb-2 text-left">마감일이 지나면 투표가 종료됩니다</p>
              <div className="flex gap-2">
                <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} min={todayStr} className="flex-1" style={{ colorScheme: "dark" }} />
                {deadlineDate && (
                  <div className="w-32">
                    <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} style={{ colorScheme: "dark" }} />
                  </div>
                )}
                {deadlineDate && (
                  <IconButton bare onClick={() => { setDeadlineDate(""); setDeadlineTime("23:59"); }} aria-label="마감일 삭제">
                    <CloseIcon className="size-4" />
                  </IconButton>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4"><div className="border-t border-border/50" /></div>

        {/* 셋리스트 곡 수 */}
        <div className="px-4 py-3">
          {/* The stepper sits under the text like the date input above; beside it, a 375px card had no room for the label. */}
          <div className="flex items-start gap-3">
            <ListRowIcon className="shrink-0 mt-0.5 text-primary-fg">
              <SetlistIcon className="size-5" />
            </ListRowIcon>
            <div className="flex-1 min-w-0">
              <label className="block text-sm text-text font-medium text-left">셋리스트 곡 수</label>
              <p className="text-caption text-text-muted mt-0.5 mb-2 text-left">투표 종료 후 상위 N곡이 셋리스트로 선정됩니다</p>
              <div className="flex items-center gap-1">
                <IconButton onClick={() => setSetlistCount((c) => Math.max(0, c - 1))} disabled={setlistCount <= 0} aria-label="곡 수 줄이기">
                  <MinusIcon className="size-4" />
                </IconButton>
                <span className={`min-w-20 text-center text-sm tabular-nums ${setlistCount > 0 ? "font-semibold text-text" : "text-text-subtle"}`}>{setlistCount > 0 ? `${setlistCount}곡` : "정하지 않음"}</span>
                <IconButton onClick={() => setSetlistCount((c) => Math.min(30, c + 1))} disabled={setlistCount >= 30} aria-label="곡 수 늘리기">
                  <PlusIcon className="size-4" />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </Card>
      )}
    </form>
  );
}
