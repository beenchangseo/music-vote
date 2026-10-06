"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { createTeam, createTeamFromPlaylist } from "@/actions/team";
import { getVotingSettings } from "@/actions/member";
import { track } from "@/lib/analytics";
import { TEAM_NAME_MAX } from "@/lib/team-domain";
import { teamMessage } from "@/lib/team-messages";

/** 방에서 막 만든 밴드. 방에 머무는 성공 카드와 초대 시트가 쓴다 (D30A·R6). */
export interface CreatedBand {
  teamId: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

/** 홈에서 고르는 "같이 투표한 멤버" 플레이리스트 (DR3): 내가 방장 · 밴드 없음 · 로그인 멤버 ≥ 2. */
export interface BandCandidate {
  id: string;
  title: string;
  /** 로그인 참여자 수(나 포함). 올리면 모두 멤버가 된다. */
  memberCount: number;
  /** 나를 뺀 참여자 앞 3명. */
  memberPreview: string[];
}

type PromoteProps = {
  /** 방 설정 행이나 플레이리스트 안 안내 카드에서 연다. 만든 뒤 방에 머문다. */
  mode?: "promote";
  playlistId: string;
  adminToken: string | null;
  /** team_created 이벤트의 출처. 방 설정 행이면 settings, 안내 카드면 card. */
  source: "card" | "settings";
  onCreated: (band: CreatedBand) => void;
};

type HomeProps = {
  /** 홈의 "새 밴드"(home)나 홈 카드(home_card)에서 연다. 만든 뒤 밴드 홈으로 간다. */
  mode: "home";
  source: "home" | "home_card";
  /** "같이 투표한 멤버로 만들기" 목록. 비면 바로 빈 밴드 이름 입력. */
  candidates: BandCandidate[];
  /** 내가 참여만 한(방장 아님) 밴드 없는 플레이리스트 중 가장 최근 것의 제목 (DR11). 없으면 null. */
  participantOnlyTitle: string | null;
  /** 홈 카드처럼 대상이 이미 정해졌을 때: 고르기 없이 그 플레이리스트의 이름 입력부터. */
  target?: BandCandidate;
};

type CreateBandSheetProps = { open: boolean; onClose: () => void } & (PromoteProps | HomeProps);

/**
 * "밴드 만들기" 시트 (디자인 리뷰 9A·10A, DR3 · DR11 · DR14).
 * - promote: 방 설정 행과 안내 카드(F7)가 연다. 그 방의 참여자가 모두 멤버가 된다.
 * - home: 홈에서 연다. 대상 플레이리스트가 있으면 먼저 고르게 하고, 아니면 멤버 없는 빈 밴드를 만든다.
 * 이름은 비운 채 포커스 (방 제목은 보통 공연 이름이라 미리 채우지 않는다).
 */
export default function CreateBandSheet(props: CreateBandSheetProps) {
  // initialFocus instead of autoFocus so focus goes back to the opener on close.
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={props.open} onClose={props.onClose} title="밴드 만들기" initialFocus={inputRef}>
      {props.mode === "home" ? (
        <HomeBody {...props} inputRef={inputRef} />
      ) : (
        <PromoteBody {...props} inputRef={inputRef} />
      )}
    </Modal>
  );
}

type InputRef = { inputRef: RefObject<HTMLInputElement | null> };

function PromoteBody({
  playlistId,
  adminToken,
  source,
  onCreated,
  onClose,
  inputRef,
}: PromoteProps & { onClose: () => void } & InputRef) {
  // Participants who become members. Reuses the owner-only room settings read (member.ts).
  const [memberNames, setMemberNames] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    getVotingSettings(playlistId, adminToken)
      .then((settings) => {
        if (active) setMemberNames(settings.members.map((member) => member.display_name));
      })
      .catch(() => {
        // The preview is a courtesy; the server copies the participants either way.
        if (active) setMemberNames([]);
      });
    return () => {
      active = false;
    };
  }, [playlistId, adminToken]);

  return (
    <NameForm
      inputRef={inputRef}
      onSubmit={async (name) => {
        const result = await createTeamFromPlaylist(playlistId, name);
        if (!result.success) return result.reason;
        track("team_created", { source });
        onCreated({
          teamId: result.teamId,
          name: result.name,
          inviteCode: result.inviteCode,
          memberCount: result.memberCount,
        });
        return null;
      }}
      note={
        memberNames === null ? (
          <p className="text-sm text-text-muted">참여자를 불러오는 중…</p>
        ) : memberNames.length > 0 ? (
          <>
            <p className="text-sm font-medium text-text">이 플레이리스트 참여자 {memberNames.length}명이 멤버가 돼요</p>
            <p className="mt-1 text-caption leading-relaxed text-text-muted">{memberNames.join(", ")}</p>
          </>
        ) : (
          <p className="text-sm text-text-muted">이 플레이리스트 참여자가 모두 멤버가 돼요</p>
        )
      }
      footer={
        <Button type="button" variant="ghost" fullWidth className="mt-2" onClick={onClose}>
          나중에
        </Button>
      }
    />
  );
}

function HomeBody({ source, candidates, participantOnlyTitle, target, inputRef }: HomeProps & InputRef) {
  const router = useRouter();
  // With candidates the sheet asks first (DR3); otherwise it goes straight to an empty band.
  const [step, setStep] = useState<"choose" | "empty" | BandCandidate>(
    target ?? (candidates.length > 0 ? "choose" : "empty"),
  );
  // Back from a name step lands on the row just left. A card opens on its own playlist, so it has no back.
  const canGoBack = !target && candidates.length > 0;
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const returnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (step === "choose" && returnTo) returnRef.current?.focus();
  }, [step, returnTo]);

  function back() {
    setReturnTo(typeof step === "object" ? step.id : "empty");
    setStep("choose");
  }

  const backButton = canGoBack && (
    <Button type="button" variant="ghost" fullWidth className="mt-2" onClick={back}>
      다시 고르기
    </Button>
  );

  function created(teamId: string) {
    track("team_created", { source });
    router.push(`/band/${teamId}?created=1`);
  }

  // DR11: a member of someone else's band-less playlist may be about to split that band in two.
  const participantNote = participantOnlyTitle && (
    <p className="mb-4 rounded-control bg-surface px-3 py-2.5 text-sm leading-relaxed text-text-muted">
      「{participantOnlyTitle}」 멤버와 같은 밴드라면, 방장이 그 플레이리스트에서 만들면 다 같이 들어가요
    </p>
  );

  if (step === "choose") {
    return (
      <div>
        {participantNote}
        <p className="text-sm font-semibold text-text">같이 투표한 멤버로 만들기</p>
        <ul className="mt-2 space-y-2">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                ref={returnTo === candidate.id ? returnRef : undefined}
                onClick={() => setStep(candidate)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                {/* Names tell apart playlists with similar titles before picking one. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-text">{candidate.title}</span>
                  {candidate.memberPreview.length > 0 && (
                    <span className="mt-0.5 block truncate text-caption text-text-muted">{memberLine(candidate)}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-text-muted tabular-nums">멤버 {candidate.memberCount}명</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          ref={returnTo === "empty" ? returnRef : undefined}
          onClick={() => setStep("empty")}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-text-muted transition-colors hover:text-text"
        >
          멤버 없이 새 밴드로 시작
        </button>
      </div>
    );
  }

  if (step === "empty") {
    return (
      <NameForm
        inputRef={inputRef}
        focusOnMount={candidates.length > 0}
        header={participantNote}
        onSubmit={async (name) => {
          const result = await createTeam(name);
          if (!result.success) return result.reason;
          created(result.teamId);
          return null;
        }}
        // DR14: no participant box for an empty band, one line on what comes next instead.
        note={<p className="text-sm text-text-muted">만들고 나면 단톡방에 초대 링크를 보내요</p>}
        footer={backButton}
      />
    );
  }

  const others = memberLine(step);
  return (
    <NameForm
      inputRef={inputRef}
      focusOnMount
      onSubmit={async (name) => {
        const result = await createTeamFromPlaylist(step.id, name);
        if (!result.success) return result.reason;
        created(result.teamId);
        return null;
      }}
      note={
        <>
          <p className="text-sm font-medium text-text">
            「{step.title}」 참여자 {step.memberCount}명이 멤버가 돼요
          </p>
          {others && <p className="mt-1 text-caption leading-relaxed text-text-muted">{others}</p>}
        </>
      }
      footer={backButton}
    />
  );
}

/** "기타, 베이스, 드럼 외 1명". memberPreview 는 나를 뺀 앞 3명, memberCount 는 나를 포함한다. */
function memberLine(candidate: BandCandidate): string {
  if (candidate.memberPreview.length === 0) return "";
  const rest = candidate.memberCount - 1 - candidate.memberPreview.length;
  return candidate.memberPreview.join(", ") + (rest > 0 ? ` 외 ${rest}명` : "");
}

/** 밴드 이름 입력 + 만들기. onSubmit 은 실패면 reason, 성공이면 null 을 돌려준다. */
function NameForm({
  inputRef,
  onSubmit,
  note,
  header,
  footer,
  focusOnMount = false,
}: InputRef & {
  onSubmit: (name: string) => Promise<string | null>;
  note: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  /** 시트 안에서 고르기 단계 다음에 나타날 때. 처음부터 보이면 Modal 의 initialFocus 가 맡는다. */
  focusOnMount?: boolean;
}) {
  const inputId = useId();
  const helpId = useId();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount, inputRef]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    // On success the sheet closes or the page moves on; staying busy blocks a second band meanwhile.
    let succeeded = false;
    try {
      const reason = await onSubmit(name);
      if (reason) setError(teamMessage(reason));
      else succeeded = true;
    } catch (caught) {
      setError(teamMessage(caught));
    } finally {
      if (!succeeded) setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {header}
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        밴드 이름
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={TEAM_NAME_MAX}
        aria-describedby={helpId}
        invalid={!!error}
        className="mt-2"
        autoComplete="off"
      />
      <p id={helpId} className="mt-2 text-caption leading-relaxed text-text-muted">
        나중에 바꿀 수 없어요. 공연 이름 말고 밴드 이름을 써 주세요
      </p>

      {/* A filled box without a border, like the DR11 note: only the input above has an outline. */}
      <div className="mt-4 rounded-control bg-surface px-3 py-2.5">{note}</div>

      <Button type="submit" size="lg" fullWidth className="mt-5" disabled={!name.trim()} loading={pending}>
        밴드 만들기
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {footer}
    </form>
  );
}
