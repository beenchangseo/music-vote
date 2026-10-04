"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addTap, bpmFromTaps, TAP_RESET_MS, TAPS_TO_FILL } from "@/lib/tap-tempo";

/** 100ms 앞까지 미리 예약한다. setInterval 지터를 오디오 클럭으로 흡수한다. */
const SCHEDULE_AHEAD = 0.1;
/** 예약 펌프 간격. 오디오 타이밍은 이 값에 의존하지 않는다. */
const TIMER_INTERVAL = 25;
const BEATS_PER_BAR = 4;

/**
 * 메트로놈 오디오 엔진.
 *
 * 전용 페이지와 합주 모드가 같은 소리를 내야 해서 훅으로 뺐다.
 * 화면은 각자 그리고 여기서는 소리와 박자만 다룬다.
 */
export function useMetronome(bpm: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);

  const playClick = useCallback((time: number, accent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = accent ? 1000 : 800;
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      playClick(nextNoteTimeRef.current, beatRef.current === 0);

      const currentBeat = beatRef.current;
      const delay = (nextNoteTimeRef.current - ctx.currentTime) * 1000;
      setTimeout(() => setBeat(currentBeat), Math.max(0, delay));

      nextNoteTimeRef.current += 60.0 / bpm;
      beatRef.current = (beatRef.current + 1) % BEATS_PER_BAR;
    }
  }, [bpm, playClick]);

  const start = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;
    setBeat(0);
    setIsPlaying(true);
    timerRef.current = setInterval(scheduler, TIMER_INTERVAL);
  }, [scheduler]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setBeat(0);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  // BPM 이 바뀌면 예약 루프를 새 값으로 다시 건다.
  useEffect(() => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(scheduler, TIMER_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scheduler, isPlaying]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  return { isPlaying, beat, start, stop, toggle, beatsPerBar: BEATS_PER_BAR };
}

/**
 * 탭 템포. 메트로놈 옆에 붙는다.
 *
 * `tap()` 은 TAPS_TO_FILL 번째 탭부터 그 순간의 BPM 을 돌려준다(화면을 바로 채우는 용도).
 * TAP_RESET_MS 동안 멈추거나 언마운트되면 마지막 BPM 을 `onCommit` 으로 한 번 넘긴다.
 * 저장은 묶음이 끝날 때 한 번이라 탭마다 서버를 부르지 않는다.
 */
export function useTapTempo(onCommit: (bpm: number, tapCount: number) => void) {
  const [taps, setTaps] = useState<readonly number[]>([]);
  const tapsRef = useRef<readonly number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const commit = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const done = tapsRef.current;
    tapsRef.current = [];
    setTaps([]);
    const bpm = done.length >= TAPS_TO_FILL ? bpmFromTaps(done) : null;
    if (bpm !== null) onCommitRef.current(bpm, done.length);
  }, []);

  const tap = useCallback((): number | null => {
    const next = addTap(tapsRef.current, performance.now());
    tapsRef.current = next;
    setTaps(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commit, TAP_RESET_MS);
    return next.length >= TAPS_TO_FILL ? bpmFromTaps(next) : null;
  }, [commit]);

  // 묶음 도중에 곡·탭을 넘겨도 다 채운 BPM 은 남긴다.
  useEffect(() => commit, [commit]);

  return { tap, tapCount: taps.length, tapsToFill: TAPS_TO_FILL };
}
