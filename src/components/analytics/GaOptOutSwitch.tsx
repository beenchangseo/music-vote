"use client";

import { useSyncExternalStore } from "react";
import Switch from "@/components/ui/Switch";
import { isGaOptedOut, setGaOptedOut, subscribeGaOptOut } from "@/lib/ga-opt-out";

export default function GaOptOutSwitch() {
  const optedOut = useSyncExternalStore(subscribeGaOptOut, isGaOptedOut, () => false);
  return (
    <Switch
      label="Google 애널리틱스로 사용 통계 보내기"
      description="이 브라우저에서만 적용돼요. 끄면 바로 멈춰요."
      checked={!optedOut}
      onCheckedChange={(sending) => setGaOptedOut(!sending)}
    />
  );
}
