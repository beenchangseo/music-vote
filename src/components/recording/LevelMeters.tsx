"use client";

import { useEffect, useRef } from "react";
import { CLIP_DB, channelLabels, formatDb, METER_RANGE_DB, meterLevel, peakDb } from "@/domain/recording-check";

const READOUT_MS = 150;
const METER_MIN_DB = -METER_RANGE_DB;
const FALL_PER_SECOND = 1;

export default function LevelMeters({ analysers }: { analysers: readonly AnalyserNode[] }) {
  const meters = useRef<(HTMLDivElement | null)[]>([]);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const readouts = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const buffers = analysers.map((analyser) => new Float32Array(analyser.fftSize));
    const shown = analysers.map(() => 0);
    const held = analysers.map(() => -Infinity);
    let lastFrame = performance.now();
    let lastReadout = lastFrame;
    let frame = 0;

    const draw = (now: number) => {
      const fall = ((now - lastFrame) / 1000) * FALL_PER_SECOND;
      lastFrame = now;
      const writeReadout = now - lastReadout >= READOUT_MS;
      if (writeReadout) lastReadout = now;
      analysers.forEach((analyser, i) => {
        analyser.getFloatTimeDomainData(buffers[i]);
        const db = peakDb(buffers[i]);
        shown[i] = Math.max(meterLevel(db), shown[i] - fall);
        held[i] = Math.max(held[i], db);
        const fill = fills.current[i];
        if (fill) {
          fill.style.width = `${shown[i] * 100}%`;
          fill.toggleAttribute("data-clip", db >= CLIP_DB);
        }
        if (writeReadout) {
          const readout = readouts.current[i];
          if (readout) readout.textContent = formatDb(held[i]);
          meters.current[i]?.setAttribute("aria-valuenow", String(Math.min(0, Math.max(METER_MIN_DB, Math.round(held[i])))));
          meters.current[i]?.setAttribute("aria-valuetext", formatDb(held[i]));
          held[i] = -Infinity;
        }
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analysers]);

  return (
    <div className="space-y-3">
      {channelLabels(analysers.length).map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-sm font-semibold text-text-muted">{label}</span>
          <div
            ref={(el) => {
              meters.current[i] = el;
            }}
            role="meter"
            aria-label={`${label} 입력 레벨`}
            aria-valuemin={METER_MIN_DB}
            aria-valuemax={0}
            aria-valuenow={METER_MIN_DB}
            aria-valuetext="무음"
            className="h-3 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-hover"
          >
            <span
              ref={(el) => {
                fills.current[i] = el;
              }}
              className="block h-full w-0 rounded-pill bg-primary data-clip:bg-danger"
            />
          </div>
          <span
            ref={(el) => {
              readouts.current[i] = el;
            }}
            className="w-14 shrink-0 text-right text-caption tabular-nums text-text-muted"
          >
            무음
          </span>
        </div>
      ))}
    </div>
  );
}
