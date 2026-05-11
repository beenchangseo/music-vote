"use client";

import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { track } from "@/lib/analytics";

interface SetlistCalendarButtonProps {
  shareCode: string;
  /** 셋리스트 러닝타임(초) — 기본 duration 추정용 */
  totalRuntimeSeconds: number;
  /** 셋리스트 제목 후보 */
  defaultTitle?: string;
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SetlistCalendarButton({
  shareCode,
  totalRuntimeSeconds,
  defaultTitle,
}: SetlistCalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(tomorrowDateString());
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState(defaultTitle || "");

  // 셋리스트 러닝타임 + 30분 마진을 기본값으로
  const defaultDuration = useMemo(
    () => Math.max(60, Math.ceil(totalRuntimeSeconds / 60) + 30),
    [totalRuntimeSeconds],
  );
  const [duration, setDuration] = useState(defaultDuration);

  const downloadUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("start", `${date}T${time}:00`);
    sp.set("duration", String(duration));
    if (location.trim()) sp.set("location", location.trim());
    if (title.trim()) sp.set("title", title.trim());
    return `/api/setlist-ics/${shareCode}?${sp.toString()}`;
  }, [shareCode, date, time, duration, location, title]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg bg-surface-hover hover:bg-gray-700 text-caption text-text-muted hover:text-text font-semibold transition-colors"
        aria-label="캘린더에 합주 일정 추가"
        title="캘린더에 추가 (.ics 다운로드)"
      >
        <CalendarIcon /> 캘린더
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="캘린더에 합주 추가"
      >
        <div className="space-y-4">
          <Field label="제목">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle || "합주"}
              maxLength={100}
            />
          </Field>

          <Field label="날짜 · 시간">
            <div className="flex gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ colorScheme: "dark" }}
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="!w-28"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </Field>

          <Field
            label={`길이 (분)`}
            hint={`기본 = 러닝타임 + 30분 마진 (${defaultDuration}분)`}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(15, d - 15))}
                className="w-9 h-9 rounded-lg bg-surface-hover text-text-muted font-bold hover:text-text"
                aria-label="15분 줄이기"
              >
                −
              </button>
              <Input
                type="number"
                value={duration}
                onChange={(e) =>
                  setDuration(Math.max(15, parseInt(e.target.value || "0", 10) || 0))
                }
                min={15}
                max={600}
                step={15}
                className="!w-24 text-center"
              />
              <button
                type="button"
                onClick={() => setDuration((d) => Math.min(600, d + 15))}
                className="w-9 h-9 rounded-lg bg-surface-hover text-text-muted font-bold hover:text-text"
                aria-label="15분 늘리기"
              >
                +
              </button>
            </div>
          </Field>

          <Field label="장소 (선택)">
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 홍대 그라운드 합주실 A"
              maxLength={120}
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <a
              href={downloadUrl}
              download
              onClick={() => {
                track("setlist_exported", { format: "ics" });
                // 모달은 잠시 후 자동 닫기 (UX 부드럽게)
                setTimeout(() => setOpen(false), 250);
              }}
              className="flex-1 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-all active:scale-[0.97]"
            >
              다운로드
            </a>
          </div>

          <p className="text-caption text-text-subtle text-center pt-1">
            .ics 파일이 다운로드돼요. 캘린더 앱이 열리면 그대로 추가하세요.
          </p>
        </div>
      </Modal>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-caption font-semibold text-text-muted mb-1.5">
        {label}
      </div>
      {children}
      {hint && (
        <p className="mt-1 text-caption text-text-subtle">{hint}</p>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}
