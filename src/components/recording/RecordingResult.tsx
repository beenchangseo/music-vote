"use client";

import { useId, useState, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button, { buttonClassName } from "@/components/ui/Button";
import ButtonGroup from "@/components/ui/ButtonGroup";
import InlineNotice from "@/components/ui/InlineNotice";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatRuntime } from "@/domain/setlist";
import {
  AUDIO_SETTING_KEYS,
  describeClient,
  formatBytes,
  formatDb,
  MIME_CANDIDATES,
  MUSIC_AUDIO,
  RECORDING_EVENTS,
  recordingFormat,
  resultMarkdown,
  STOP_REASONS,
  channelLabels,
  type AudioSettingKey,
  type Capability,
  type MixerVerdict,
  type RecordingCheck,
  type StopReason,
} from "@/domain/recording-check";

const VERDICTS = [
  { value: "unchecked", label: "확인 전" },
  { value: "mixer", label: "믹서 소리" },
  { value: "not-mixer", label: "아니에요" },
] as const;

const SETTING_LABELS: Readonly<Record<AudioSettingKey, string>> = {
  sampleRate: "샘플레이트",
  channelCount: "채널",
  echoCancellation: "에코 제거",
  noiseSuppression: "잡음 제거",
  autoGainControl: "자동 음량",
  latency: "지연(초)",
};

const STOP_NOTICES: Partial<Record<StopReason, string>> = {
  "input-ended": "녹음 중에 입력이 끊겼어요. 끊기기 전까지 녹음한 것은 그대로 남겼어요.",
  "recorder-error": "녹음기 오류로 녹음이 멈췄어요. 멈추기 전까지 녹음한 것은 그대로 남겼어요.",
  browser:
    "브라우저가 녹음을 먼저 멈췄어요. 화면을 잠갔거나 다른 앱으로 넘어갔다면 그 때문일 수 있어요. 멈추기 전까지 녹음한 것은 그대로 남겼어요.",
};

const PERMISSION_LABELS = { granted: "허용", denied: "거절", prompt: "묻는 중", unknown: "알 수 없음" } as const;

function settingValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "켬" : "끔";
  if (value && typeof value === "object" && "ideal" in value) return `${String(value.ideal)} 희망`;
  return String(value);
}

function capabilityValue(capability: Capability | undefined): string {
  if (!capability) return "—";
  if (Array.isArray(capability)) return capability.map(settingValue).join("·") || "—";
  const { min, max } = capability as { min?: number; max?: number };
  return min === max ? settingValue(min) : `${settingValue(min)}–${settingValue(max)}`;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <dt className="w-24 shrink-0 text-text-muted">{term}</dt>
      <dd className="min-w-0 flex-1 break-words text-text">{children}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

interface RecordingResultProps {
  check: RecordingCheck;
  url: string;
  fileName: string;
  onPlayerSeconds: (seconds: number | null) => void;
}

export default function RecordingResult({ check, url, fileName, onPlayerSeconds }: RecordingResultProps) {
  const [verdict, setVerdict] = useState<MixerVerdict>("unchecked");
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const verdictLabel = useId();
  const markdown = resultMarkdown(check, verdict);
  const { decoded } = check;
  const stopNotice = STOP_NOTICES[check.stoppedBy];
  const format = recordingFormat(check.mimeType);

  async function onCopy() {
    setCopy((await copyText(markdown)) ? "copied" : "failed");
  }

  return (
    <div className="space-y-4">
      {stopNotice && <InlineNotice tone="warning">{stopNotice}</InlineNotice>}

      <audio
        controls
        src={url}
        className="w-full"
        onLoadedMetadata={(e) => {
          const seconds = e.currentTarget.duration;
          onPlayerSeconds(Number.isFinite(seconds) ? seconds : null);
        }}
      />

      <div>
        <p id={verdictLabel} className="text-sm font-semibold text-text">
          재생해 보니 믹서 소리였나요?
        </p>
        <SegmentedControl
          aria-labelledby={verdictLabel}
          className="mt-2"
          options={VERDICTS}
          value={verdict}
          onChange={(value) => {
            setVerdict(value);
            setCopy("idle");
          }}
        />
      </div>

      <ButtonGroup>
        <a href={url} download={fileName} className={buttonClassName({ variant: "tonal" })}>
          파일 내려받기
        </a>
        <Button variant="primary" onClick={onCopy}>
          결과 복사
        </Button>
      </ButtonGroup>
      <p role="status" className="text-sm text-text-muted">
        {copy === "copied" && "복사했어요. 이슈 #77 댓글에 붙여 넣어요."}
        {copy === "failed" && "복사하지 못했어요. 아래 글을 길게 눌러 복사해요."}
      </p>
      {copy === "failed" && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-control bg-surface-hover p-3 text-caption text-text select-all">
          {markdown}
        </pre>
      )}
      <p className="text-caption text-text-muted">복사한 글에는 브라우저 정보와 입력 장치 이름이 들어가요.</p>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-text">파일</h3>
        <dl className="mt-1 divide-y divide-border text-sm">
          <Row term="실제 형식">{check.mimeType || "(빈 값)"}</Row>
          <Row term="저장 형식">{format ? `${format.contentType} · .${format.extension}` : "모르는 형식"}</Row>
          <Row term="파일 이름">{fileName}</Row>
          <Row term="크기">{formatBytes(check.file.bytes)}</Row>
          <Row term="녹음 시간">{formatRuntime(check.file.wallMs / 1000)}</Row>
          <Row term="조각">{check.file.chunks}개</Row>
          <Row term="멈춘 이유">{STOP_REASONS[check.stoppedBy]}</Row>
          <Row term="재생기 길이">
            {check.playerSeconds === undefined
              ? "읽는 중"
              : check.playerSeconds === null
                ? "길이를 못 읽어요. 이 파일로는 곡 시작점으로 넘기기 어려워요."
                : formatRuntime(check.playerSeconds)}
          </Row>
        </dl>

        <Group title="파일 다시 읽기">
          <dl className="divide-y divide-border text-sm">
            {decoded.status === "decoded" ? (
              <>
                <Row term="채널">
                  {decoded.channels}
                  {decoded.stereo === "dual-mono" && " · 좌우 같음"}
                  {decoded.stereo === "distinct" && " · 좌우 다름"}
                </Row>
                <Row term="샘플레이트">{decoded.sampleRate}Hz</Row>
                <Row term="길이">{decoded.durationSec.toFixed(2)}초</Row>
                <Row term="최대 레벨">
                  {decoded.peakDb.map((db, i) => `${channelLabels(decoded.peakDb.length)[i]} ${formatDb(db)}`).join(" · ")}
                </Row>
              </>
            ) : decoded.status === "failed" ? (
              <Row term="결과">못 읽었어요 ({decoded.error})</Row>
            ) : (
              <Row term="결과">{decoded.reason === "too-long" ? "5분이 넘어서 건너뛰었어요. 재생기로 확인해요." : "녹음된 내용이 없어요."}</Row>
            )}
          </dl>
          {decoded.status === "decoded" && (
            <p className="mt-1 text-caption text-text-muted">샘플레이트는 브라우저가 재생에 맞춰 다시 계산한 값이라 파일 원래 값과 다를 수 있어요.</p>
          )}
        </Group>

        <Group title="입력">
          <dl className="divide-y divide-border text-sm">
            <Row term="장치">{check.device.label || "이름 없음"}</Row>
            <Row term="목록">
              {check.device.listed.length === 0
                ? "브라우저가 목록을 주지 않았어요"
                : check.device.listed.map((label, i) => `${i === check.device.index ? "▸ " : ""}${label || `입력 ${i + 1}`}`).join(", ")}
            </Row>
            <Row term="권한">{PERMISSION_LABELS[check.permission]}</Row>
          </dl>
        </Group>

        <Group title="요청한 설정과 실제 설정">
          <dl className="divide-y divide-border text-sm tabular-nums">
            {AUDIO_SETTING_KEYS.map((key) => (
              <Row key={key} term={SETTING_LABELS[key]}>
                요청 {settingValue(MUSIC_AUDIO[key as keyof typeof MUSIC_AUDIO])} · 실제 {settingValue(check.settings[key])}
                <span className="block text-caption text-text-muted">
                  범위 {check.capabilities ? capabilityValue(check.capabilities[key]) : "브라우저가 알려 주지 않아요"}
                </span>
              </Row>
            ))}
          </dl>
        </Group>

        <Group title="녹음 형식 지원">
          <ul className="divide-y divide-border text-sm">
            {MIME_CANDIDATES.map((type) => (
              <li key={type} className="flex items-center gap-2 py-2">
                <code className="min-w-0 flex-1 break-all text-caption text-text">{type}</code>
                {type === check.requested.mimeType && <Badge tone="primary">요청함</Badge>}
                <Badge tone={check.mimeSupport[type] ? "neutral" : "warning"}>{check.mimeSupport[type] ? "지원" : "안 됨"}</Badge>
              </li>
            ))}
          </ul>
        </Group>

        <Group title="녹음 중 일어난 일">
          {check.events.length === 0 ? (
            <p className="py-2 text-sm text-text-muted">없어요.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {check.events.map((event, i) => (
                <li key={i} className="flex gap-3 py-2">
                  <span className="w-14 shrink-0 tabular-nums text-text-muted">{formatRuntime(event.atMs / 1000)}</span>
                  <span className="min-w-0 flex-1 text-text">
                    {RECORDING_EVENTS[event.type]}
                    {event.detail && ` (${event.detail})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Group>

        <Group title="브라우저">
          <p className="text-sm text-text">{describeClient(check.userAgent, check.clientHints)}</p>
          <p className="mt-1 break-all text-caption text-text-muted">{check.userAgent}</p>
        </Group>
      </div>
    </div>
  );
}
