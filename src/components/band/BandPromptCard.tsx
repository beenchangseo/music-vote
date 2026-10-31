"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Button, { buttonClassName } from "../ui/Button";
import NoticeCard from "../ui/NoticeCard";
import CreateBandSheet, { type BandCandidate, type CreatedBand } from "./CreateBandSheet";
import { dismissBandPrompt, hasBandPromptDismissal, migrateLegacyDismissal } from "@/lib/prompt-dismissals";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * 닫힘 기억 (DR6). 서버가 쿠키를 읽어 `dismissed` 로 넘기므로 카드는 첫 화면부터 맞게 그려진다.
 * 마운트 때 한 번 더 본다: 클라이언트 이동 캐시로 서버 값이 낡았거나 쿠키 전 localStorage 기록이 있을 때(O5).
 */
function useBandPromptDismissal(playlistId: string, dismissed: boolean) {
  // Hydrates with the server's answer, then reads this browser's record.
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => dismissed || hasBandPromptDismissal(playlistId),
    () => dismissed,
  );
  const [closed, setClosed] = useState(false);
  useEffect(() => migrateLegacyDismissal(playlistId), [playlistId]);
  return {
    closed: stored || closed,
    dismiss() {
      setClosed(true);
      dismissBandPrompt(playlistId);
    },
  };
}

interface BandPromptCardProps {
  playlistId: string;
  adminToken: string | null;
  /** 서버가 읽은 닫힘 쿠키 (DR6). */
  dismissed: boolean;
  onCreated: (band: CreatedBand) => void;
}

/**
 * 방장에게 보이는 밴드 만들기 안내 카드 (CEO-F7, 디자인 27A). 후보곡 탭의 툴바 아래에만 놓인다.
 * 보일지(방장 · 팀 없음 · 로그인 멤버 ≥ 2)는 PlaylistClient 가 정하고, 닫기 기억은 여기서 한다.
 * 닫으면 그 플레이리스트에서는(홈 카드에서도) 다시 뜨지 않는다. 쿠키를 못 쓰면 이번 화면에서만 닫힌다.
 */
export default function BandPromptCard({ playlistId, adminToken, dismissed, onCreated }: BandPromptCardProps) {
  const { closed, dismiss } = useBandPromptDismissal(playlistId, dismissed);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (closed) return null;

  return (
    <>
      <NoticeCard
        className="mb-3"
        onDismiss={dismiss}
        actions={
          <Button variant="tonal" size="sm" onClick={() => setSheetOpen(true)}>
            밴드 이름 정하고 만들기
          </Button>
        }
      >
        이 멤버 그대로 다음 공연도 해요? 밴드로 묶어두면 다음 플레이리스트는 버튼 한 번이에요
      </NoticeCard>
      <CreateBandSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        playlistId={playlistId}
        adminToken={adminToken}
        source="card"
        onCreated={(band) => {
          setSheetOpen(false);
          onCreated(band);
        }}
      />
    </>
  );
}

/**
 * 홈의 밴드 만들기 카드 (CEO2-D, DR4 · DR5 · DR6). 밴드가 하나도 없는 방장에게, 같이 투표한 멤버가 있는
 * 가장 최근 플레이리스트 하나만 보인다(누가 대상인지는 홈 서버가 정한다). 닫으면 예전 후보로 바꿔 보이지 않는다.
 * 만들면 그 플레이리스트 참여자가 모두 멤버인 밴드의 홈으로 간다.
 */
export function HomeBandCard({ candidate, dismissed }: { candidate: BandCandidate; dismissed: boolean }) {
  const { closed, dismiss } = useBandPromptDismissal(candidate.id, dismissed);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (closed) return null;

  return (
    <>
      <NoticeCard
        className="mt-5"
        title={<span className="block truncate">「{candidate.title}」</span>}
        onDismiss={dismiss}
        actions={
          <Button variant="tonal" size="sm" onClick={() => setSheetOpen(true)}>
            이 멤버로 밴드 만들기
          </Button>
        }
      >
        <p>멤버 {candidate.memberCount}명, 다음 공연도 같이 해요?</p>
        {candidate.memberPreview.length > 0 && (
          <p className="mt-1 truncate text-caption">{candidate.memberPreview.join(", ")}</p>
        )}
      </NoticeCard>
      <CreateBandSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode="home"
        source="home_card"
        candidates={[candidate]}
        target={candidate}
        participantOnlyTitle={null}
      />
    </>
  );
}

/**
 * 안내 카드로 만든 직후 그 자리에 한 번 뜨는 성공 카드 (D30A). 상태는 PlaylistClient 가 든다(R6):
 * 액션의 revalidatePath 로 안내 카드 조건이 거짓이 돼도 남고, 닫거나 새로고침하면 사라진다.
 */
export function BandCreatedCard({
  band,
  onShare,
  onDismiss,
}: {
  band: CreatedBand;
  onShare: () => void;
  onDismiss: () => void;
}) {
  return (
    <NoticeCard
      role="status"
      className="mb-3"
      tone="success"
      icon={
        <svg className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      }
      title="밴드를 만들었어요"
      onDismiss={onDismiss}
      dismissLabel="닫기"
      actions={
        <>
          <Button variant="kakao" onClick={onShare}>
            카톡으로 알리기
          </Button>
          <Link href={`/band/${band.teamId}`} className={buttonClassName({ variant: "tonal", size: "md" })}>
            밴드 홈
          </Link>
        </>
      }
    >
      <p className="truncate">
        {band.name} · 멤버 {band.memberCount}명
      </p>
    </NoticeCard>
  );
}
