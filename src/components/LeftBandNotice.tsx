"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";

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
    <Card role="status" className="mb-6 flex items-center gap-3 animate-fade-in">
      <p className="min-w-0 flex-1 text-sm text-text">{name ? `${name}에서 나왔어요` : "밴드에서 나왔어요"}</p>
      <IconButton bare aria-label="닫기" onClick={() => setOpen(false)} className="-my-2 -mr-2">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </IconButton>
    </Card>
  );
}
