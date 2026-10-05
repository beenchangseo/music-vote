"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Card from "./ui/Card";
import Button, { buttonClassName } from "./ui/Button";
import IconButton from "./ui/IconButton";
import CreateBandSheet, { type CreatedBand } from "./CreateBandSheet";
import { KakaoInviteButton } from "./BandInviteSheet";

const dismissKey = (playlistId: string) => `plypick:band-prompt-dismissed:${playlistId}`;

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface BandPromptCardProps {
  playlistId: string;
  adminToken: string | null;
  onCreated: (band: CreatedBand) => void;
}

/**
 * 방장에게 보이는 밴드 만들기 안내 카드 (CEO-F7, 디자인 27A). 후보곡 탭의 툴바 아래에만 놓인다.
 * 보일지(방장 · 팀 없음 · 로그인 멤버 ≥ 2)는 PlaylistClient 가 정하고, 닫기 기억은 여기서 한다.
 * 닫으면 그 방에서는 다시 뜨지 않는다. localStorage 가 막혀도 카드는 렌더되고 이번 화면에서만 닫힌다.
 */
export default function BandPromptCard({ playlistId, adminToken, onCreated }: BandPromptCardProps) {
  const storedDismissed = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(dismissKey(playlistId)) === "1";
      } catch {
        return false;
      }
    },
    // Server render: stay hidden so a dismissed card never flashes before hydration.
    () => true,
  );
  const [closed, setClosed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (storedDismissed || closed) return null;

  function dismiss() {
    setClosed(true);
    try {
      window.localStorage.setItem(dismissKey(playlistId), "1");
    } catch {
      // Hidden for this visit only.
    }
  }

  return (
    <Card variant="outline" className="mb-3 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-text">
          이 멤버 그대로 다음 공연도 해요? 밴드로 묶어두면 다음 플레이리스트는 버튼 한 번이에요
        </p>
        <Button size="sm" className="mt-3 min-h-11" onClick={() => setSheetOpen(true)}>
          밴드 이름 정하고 만들기
        </Button>
      </div>
      <IconButton bare aria-label="안내 닫기" onClick={dismiss} className="-my-2 -mr-2">
        <CloseIcon />
      </IconButton>
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
    </Card>
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
    <Card role="status" className="mb-3 flex items-start gap-3">
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">밴드를 만들었어요</p>
        <p className="mt-0.5 truncate text-caption text-text-muted">
          {band.name} · 멤버 {band.memberCount}명
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <KakaoInviteButton onClick={onShare}>카톡으로 알리기</KakaoInviteButton>
          <Link href={`/band/${band.teamId}`} className={buttonClassName({ variant: "secondary", size: "md" })}>
            밴드 홈
          </Link>
        </div>
      </div>
      <IconButton bare aria-label="닫기" onClick={onDismiss} className="-my-2 -mr-2">
        <CloseIcon />
      </IconButton>
    </Card>
  );
}
