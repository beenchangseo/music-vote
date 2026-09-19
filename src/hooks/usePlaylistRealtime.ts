"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CHANGE_EVENT = "playlist_changed";
/** 표가 몰릴 때 새로고침이 겹치지 않도록 최소 간격을 둔다. */
const REFRESH_INTERVAL_MS = 1000;

/**
 * 같은 합주방을 보고 있는 다른 화면에 "바뀌었다"만 알린다.
 * 값은 각자 다시 받아간다. votes 테이블 변경을 그대로 흘려보내면
 * 익명 모드에서 투표자가 드러나기 때문에 내용은 싣지 않는다.
 */
export function usePlaylistRealtime(shareCode: string, onRemoteChange: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const missedRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 콜백이 바뀔 때마다 채널을 다시 열지 않도록 최신 값만 들고 있는다.
  const onRemoteChangeRef = useRef(onRemoteChange);
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  const scheduleRefresh = useCallback(() => {
    // 안 보이는 탭을 갱신할 이유가 없다. 돌아올 때 한 번만 받아온다.
    if (document.hidden) {
      missedRef.current = true;
      return;
    }
    if (timerRef.current) return;
    const wait = Math.max(0, REFRESH_INTERVAL_MS - (Date.now() - lastRefreshRef.current));
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      missedRef.current = false;
      lastRefreshRef.current = Date.now();
      onRemoteChangeRef.current();
    }, wait);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`playlist:${shareCode}`);
    channel.on("broadcast", { event: CHANGE_EVENT }, () => scheduleRefresh()).subscribe();
    channelRef.current = channel;

    function handleVisibilityChange() {
      if (!document.hidden && missedRef.current) scheduleRefresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [shareCode, scheduleRefresh]);

  /** 내 변경을 다른 화면에 알린다. 실패해도 내 화면은 이미 갱신돼 있다. */
  const notifyChange = useCallback(() => {
    channelRef.current
      ?.send({ type: "broadcast", event: CHANGE_EVENT, payload: {} })
      .catch(() => undefined);
  }, []);

  return { notifyChange };
}
