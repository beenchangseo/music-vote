"use client";

import { useState, useMemo } from "react";

interface DeadlinePickerProps {
  value: string; // ISO datetime-local string
  onChange: (value: string) => void;
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TIME_PRESETS = [
  { label: "정오", hour: 12, minute: 0 },
  { label: "오후 6시", hour: 18, minute: 0 },
  { label: "오후 9시", hour: 21, minute: 0 },
  { label: "자정", hour: 23, minute: 59 },
];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toISOWithTimezone(dateKey: string, hour: number, minute: number) {
  // Create Date in user's local timezone, then convert to ISO string (UTC)
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(year, month - 1, day, hour, minute, 0);
  return d.toISOString();
}

function formatDeadline(dateKey: string, hour: number, minute: number) {
  const d = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAYS[d.getDay()];
  const ampm = hour < 12 ? "오전" : "오후";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute > 0 ? ` ${minute}분` : "";
  return `${month}월 ${day}일 (${dayName}) ${ampm} ${displayHour}시${displayMinute}`;
}

export default function DeadlinePicker({ value, onChange }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [step, setStep] = useState<"date" | "time">("date");
  const [showCustomTime, setShowCustomTime] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = toDateKey(today);

  // Quick date presets
  const quickDates = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return [
      { label: "내일", date: tomorrow },
      { label: "모레", date: dayAfter },
      { label: "일주일 뒤", date: nextWeek },
    ];
  }, [today]);

  // Calendar grid for current viewDate month
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [viewDate]);

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedHour(null);
    setSelectedMinute(0);
    setShowCustomTime(false);
    setStep("time");
  }

  function handleSelectTime(hour: number, minute: number) {
    if (!selectedDate) return;
    setSelectedHour(hour);
    setSelectedMinute(minute);
    onChange(toISOWithTimezone(selectedDate, hour, minute));
    setOpen(false);
  }

  function handleClear() {
    setSelectedDate(null);
    setSelectedHour(null);
    setSelectedMinute(0);
    setStep("date");
    setShowCustomTime(false);
    onChange("");
    setOpen(false);
  }

  function prevMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  // Check if we can go to previous month (don't go before current month)
  const canGoPrev = viewDate.getFullYear() > today.getFullYear() ||
    (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() > today.getMonth());

  // Filter time presets for today
  const availableTimePresets = useMemo(() => {
    if (selectedDate !== todayKey) return TIME_PRESETS;
    const now = new Date();
    return TIME_PRESETS.filter(
      (t) => t.hour > now.getHours() || (t.hour === now.getHours() && t.minute > now.getMinutes())
    );
  }, [selectedDate, todayKey]);

  // Display summary
  if (value && !open) {
    const parsed = new Date(value);
    const summary = formatDeadline(
      toDateKey(parsed),
      parsed.getHours(),
      parsed.getMinutes()
    );
    return (
      <div className="flex items-center gap-2 animate-fade-in">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-sm text-primary transition-all hover:bg-primary/15"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">{summary} 마감</span>
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="p-2 text-gray-500 hover:text-red-400 transition-colors shrink-0"
          aria-label="마감일 삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        투표 마감일 설정
      </button>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 animate-fade-in">
      {step === "date" && (
        <>
          {/* Quick presets */}
          <div className="flex gap-2 mb-4">
            {quickDates.map((q) => {
              const key = toDateKey(q.date);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectDate(key)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    selectedDate === key
                      ? "bg-primary text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="이전 달"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-200">
              {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="다음 달"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;

              const key = toDateKey(day);
              const isPast = day < today;
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !isPast && handleSelectDate(key)}
                  disabled={isPast}
                  className={`aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-primary text-white"
                      : isPast
                      ? "text-gray-700 cursor-not-allowed"
                      : isToday
                      ? "text-primary bg-primary/10 hover:bg-primary/20"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Cancel */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => { setOpen(false); setStep("date"); }}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}

      {step === "time" && selectedDate && (
        <>
          {/* Back to date */}
          <button
            type="button"
            onClick={() => setStep("date")}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-3"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            날짜 다시 선택
          </button>

          {/* Selected date display */}
          <p className="text-sm text-gray-300 mb-4">
            <span className="text-white font-semibold">
              {(() => {
                const d = new Date(selectedDate + "T00:00");
                return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
              })()}
            </span>
            <span className="text-gray-500 ml-1">시간을 선택하세요</span>
          </p>

          {/* Time presets */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {availableTimePresets.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => handleSelectTime(t.hour, t.minute)}
                className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  selectedHour === t.hour && selectedMinute === t.minute
                    ? "bg-primary text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Custom time */}
          {!showCustomTime ? (
            <button
              type="button"
              onClick={() => setShowCustomTime(true)}
              className="w-full py-2 text-sm text-gray-500 hover:text-primary transition-colors"
            >
              직접 시간 입력
            </button>
          ) : (
            <div className="flex items-center gap-2 animate-fade-in">
              <select
                value={selectedHour ?? ""}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-center"
              >
                <option value="" disabled>시</option>
                {Array.from({ length: 24 }, (_, i) => {
                  if (selectedDate === todayKey && i <= new Date().getHours()) return null;
                  const ampm = i < 12 ? "오전" : "오후";
                  const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
                  return (
                    <option key={i} value={i}>
                      {ampm} {display}시
                    </option>
                  );
                })}
              </select>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(Number(e.target.value))}
                className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-border text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-center"
              >
                {[0, 10, 20, 30, 40, 50].map((m) => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (selectedHour !== null) handleSelectTime(selectedHour, selectedMinute);
                }}
                disabled={selectedHour === null}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
              >
                확인
              </button>
            </div>
          )}

          {/* Cancel */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}
