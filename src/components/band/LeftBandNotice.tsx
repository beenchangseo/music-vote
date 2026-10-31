"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import NoticeCard from "../ui/NoticeCard";

/** 밴드 홈이 "밴드 나가기" 직후 밴드 이름을 담아 두는 자리. 홈이 한 번 읽고 지운다. */
export const LEFT_BAND_STORAGE_KEY = "plypick:left-band";

function readLeftBandName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(LEFT_BAND_STORAGE_KEY);
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/**
 * 밴드에서 나간 뒤 홈 맨 위의 한 줄 (디자인 2회차 6A). `?left=1` 로 한 번만 뜨고,
 * 쿼리는 첫 마운트에 지운다 (11A 와 같은 규칙). 이름이 없으면 "밴드에서 나왔어요".
 */
export default function LeftBandNotice({ left }: { left: boolean }) {
  const router = useRouter();
  // The name lives in sessionStorage, which the server cannot see: render after hydration only.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Runs on the client during hydration, before the effect below removes the entry.
  const [name] = useState(() => (left ? readLeftBandName() : null));
  const [open, setOpen] = useState(left);

  useEffect(() => {
    if (!left) return;
    try {
      window.sessionStorage.removeItem(LEFT_BAND_STORAGE_KEY);
    } catch {
      // Nothing to clean up when storage is blocked.
    }
    router.replace("/", { scroll: false });
  }, [left, router]);

  if (!open || !hydrated) return null;

  return (
    <NoticeCard role="status" className="mb-6 animate-fade-in" onDismiss={() => setOpen(false)} dismissLabel="닫기">
      {name ? `${name}에서 나왔어요` : "밴드에서 나왔어요"}
    </NoticeCard>
  );
}
