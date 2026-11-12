"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonGroup from "@/components/ui/ButtonGroup";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import InlineNotice from "@/components/ui/InlineNotice";
import { ListRowButton } from "@/components/ui/ListRow";
import { formatRuntime } from "@/domain/setlist";
import {
  analyzeChannels,
  audioConstraints,
  chooseMimeType,
  DECODE_LIMIT_MS,
  micErrorMessage,
  MIME_CANDIDATES,
  missingFeatures,
  MUSIC_AUDIO,
  parseMicPermission,
  pickAudioCapabilities,
  pickAudioSettings,
  PLATFORM_FEATURES,
  RECORDING_EVENTS,
  recordingFileName,
  recordingFormat,
  type AudioCapabilities,
  type AudioSettings,
  type ClientHints,
  type DecodedAudio,
  type MicPermission,
  type MimeCandidate,
  type MimeSupport,
  type PlatformSupport,
  type RecordingCheck as CheckResult,
  type RecordingEvent,
  type RecordingEventType,
  type StopReason,
} from "@/domain/recording-check";
import LevelMeters from "./LevelMeters";
import RecordingResult from "./RecordingResult";
import { DoneIcon } from "@/components/ui/icons";

const TIMED_MS = 10_000;
const TIMESLICE_MS = 1000;
const MAX_METERS = 8;

interface InputDevice {
  deviceId: string;
  label: string;
}

interface LiveInput {
  stream: MediaStream;
  track: MediaStreamTrack;
  context: AudioContext | null;
  analysers: AnalyserNode[];
  settings: AudioSettings;
  capabilities: AudioCapabilities | null;
  devices: InputDevice[];
  index: number | null;
  chosen: boolean;
}

type Mic =
  | { phase: "idle" }
  | { phase: "opening" }
  | { phase: "failed"; error: string }
  | { phase: "live"; input: LiveInput }
  | { phase: "lost" };

type Take =
  | { phase: "idle" }
  | { phase: "recording"; mode: "timed" | "manual"; elapsedMs: number; chunks: number; events: RecordingEvent[] }
  | { phase: "processing" }
  | { phase: "done"; check: CheckResult; url: string; fileName: string }
  | { phase: "failed"; error: string };

interface Session {
  recorder: MediaRecorder;
  input: LiveInput;
  mode: "timed" | "manual";
  chunks: Blob[];
  chunkEvents: number;
  events: RecordingEvent[];
  startedAt: number;
  startedDate: Date;
  reason: StopReason | null;
  requested: MimeCandidate | null;
  mimeSupport: MimeSupport;
  timer: number | null;
  ticker: number;
}

function detectSupport(): PlatformSupport {
  return {
    secureContext: window.isSecureContext,
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    mediaRecorder: typeof window.MediaRecorder === "function",
    audioContext: typeof window.AudioContext === "function",
  };
}

const subscribeNever = () => () => {};

function errorName(error: unknown): string {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return typeof name === "string" ? name : String(error);
}

async function listInputs(): Promise<InputDevice[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch {
    return [];
  }
}

function connectMeters(context: AudioContext, stream: MediaStream, channels: number): AnalyserNode[] {
  const source = context.createMediaStreamSource(stream);
  const splitter = context.createChannelSplitter(channels);
  source.connect(splitter);
  return Array.from({ length: channels }, (_, i) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    splitter.connect(analyser, i);
    return analyser;
  });
}

function closeInput(input: LiveInput | null) {
  if (!input) return;
  input.stream.getTracks().forEach((track) => track.stop());
  if (input.context && input.context.state !== "closed") void input.context.close();
}

// iOS Safari can leave the meter's AudioContext suspended or "interrupted" after getUserMedia switches the audio
// session or the screen locks. The recording is fine, but frozen meters read as "no USB signal".
function wakeMeters(input: LiveInput | null) {
  const context = input?.context;
  if (context && context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
}

async function readMicPermission(): Promise<MicPermission> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return parseMicPermission(status.state);
  } catch {
    return "unknown";
  }
}

type UaData = { getHighEntropyValues(hints: string[]): Promise<Record<string, unknown>> };

async function readClientHints(): Promise<ClientHints | null> {
  const data = (navigator as Navigator & { userAgentData?: UaData }).userAgentData;
  if (!data) return null;
  try {
    const values = await data.getHighEntropyValues(["platformVersion", "model"]);
    const text = (value: unknown) => (typeof value === "string" ? value : undefined);
    return { platform: text(values.platform), platformVersion: text(values.platformVersion), model: text(values.model) };
  } catch {
    return null;
  }
}

async function decodeTake(blob: Blob, wallMs: number): Promise<DecodedAudio> {
  if (blob.size === 0) return { status: "skipped", reason: "empty" };
  if (wallMs > DECODE_LIMIT_MS) return { status: "skipped", reason: "too-long" };
  if (typeof window.AudioContext !== "function") return { status: "failed", error: "AudioContext 없음" };
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    return {
      status: "decoded",
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      durationSec: buffer.duration,
      ...analyzeChannels(channels),
    };
  } catch (error) {
    return { status: "failed", error: errorName(error) };
  } finally {
    void context.close();
  }
}

function recordingView(session: Session): Take {
  return {
    phase: "recording",
    mode: session.mode,
    elapsedMs: performance.now() - session.startedAt,
    chunks: session.chunkEvents,
    events: [...session.events],
  };
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-h4 font-semibold text-text">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </Card>
  );
}

function CheckIcon() {
  return (
    <DoneIcon className="size-5 text-primary-fg" />
  );
}

function SettingBadges({ settings }: { settings: AudioSettings }) {
  const flags = [
    ["에코 제거", settings.echoCancellation],
    ["잡음 제거", settings.noiseSuppression],
    ["자동 음량", settings.autoGainControl],
  ] as const;
  return (
    <div className="flex flex-wrap gap-1.5">
      {settings.sampleRate !== undefined && <Badge>{settings.sampleRate}Hz</Badge>}
      {settings.channelCount !== undefined && <Badge>채널 {settings.channelCount}</Badge>}
      {flags.map(([name, value]) =>
        value === undefined ? null : (
          <Badge key={name} tone={value === false ? "neutral" : "warning"}>
            {name} {value === false ? "끔" : "켬"}
          </Badge>
        ),
      )}
    </div>
  );
}

export default function RecordingCheck() {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const support = mounted ? detectSupport() : null;
  const [mic, setMic] = useState<Mic>({ phase: "idle" });
  const [take, setTake] = useState<Take>({ phase: "idle" });
  const inputRef = useRef<LiveInput | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const urlRef = useRef<string | null>(null);
  const latestOpenRef = useRef(0);

  function note(type: RecordingEventType, detail?: string) {
    const session = sessionRef.current;
    if (!session || session.recorder.state === "inactive") return;
    session.events.push({ type, atMs: Math.round(performance.now() - session.startedAt), ...(detail && { detail }) });
    setTake(recordingView(session));
  }

  function stopTake(reason: StopReason) {
    const session = sessionRef.current;
    if (!session || session.recorder.state === "inactive") return;
    session.reason ??= reason;
    session.recorder.stop();
  }

  function onTrackEnded(input: LiveInput) {
    note("track-ended");
    stopTake("input-ended");
    if (inputRef.current !== input) return;
    inputRef.current = null;
    closeInput(input);
    setMic({ phase: "lost" });
  }

  async function openInput(deviceId: string | null) {
    const open = ++latestOpenRef.current;
    closeInput(inputRef.current);
    inputRef.current = null;
    // Made inside the tap: iOS only lets an AudioContext run when it starts from a user gesture.
    const context = support?.audioContext ? new AudioContext() : null;
    setMic({ phase: "opening" });

    let stream: MediaStream | null = null;
    let input: LiveInput;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(deviceId) });
      const devices = await listInputs();
      const [track] = stream.getAudioTracks();
      const settings = pickAudioSettings(track.getSettings());
      const capabilities = typeof track.getCapabilities === "function" ? pickAudioCapabilities(track.getCapabilities()) : null;
      const channels = Math.min(MAX_METERS, Math.max(1, settings.channelCount ?? 2));
      const index = devices.findIndex((d) => d.deviceId === track.getSettings().deviceId);
      input = {
        stream,
        track,
        context,
        analysers: context ? connectMeters(context, stream, channels) : [],
        settings,
        capabilities,
        devices,
        index: index === -1 ? null : index,
        chosen: deviceId !== null,
      };
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      if (open === latestOpenRef.current) setMic({ phase: "failed", error: errorName(error) });
      return;
    }
    if (open !== latestOpenRef.current) {
      closeInput(input);
      return;
    }
    input.track.addEventListener("ended", () => onTrackEnded(input));
    input.track.addEventListener("mute", () => note("track-mute"));
    input.track.addEventListener("unmute", () => note("track-unmute"));
    inputRef.current = input;
    wakeMeters(input);
    setMic({ phase: "live", input });
  }

  async function finishTake(session: Session) {
    if (session.timer !== null) clearTimeout(session.timer);
    clearInterval(session.ticker);
    const wallMs = performance.now() - session.startedAt;
    const mimeType = session.recorder.mimeType || session.chunks[0]?.type || "";
    const blob = new Blob(session.chunks, { type: mimeType });
    const stoppedBy = session.reason ?? (session.input.track.readyState === "ended" ? "input-ended" : "browser");
    setTake({ phase: "processing" });

    const [decoded, permission, clientHints] = await Promise.all([decodeTake(blob, wallMs), readMicPermission(), readClientHints()]);
    if (sessionRef.current !== session) return;
    const { input } = session;
    const check: CheckResult = {
      userAgent: navigator.userAgent,
      clientHints,
      support: detectSupport(),
      permission,
      device: { index: input.index, label: input.track.label, listed: input.devices.map((d) => d.label) },
      requested: { audio: MUSIC_AUDIO, device: input.chosen ? "chosen" : "default", mimeType: session.requested },
      settings: input.settings,
      capabilities: input.capabilities,
      mimeSupport: session.mimeSupport,
      mimeType,
      file: { bytes: blob.size, chunks: session.chunkEvents, wallMs: Math.round(wallMs) },
      decoded,
      events: session.events,
      stoppedBy,
    };
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setTake({ phase: "done", check, url, fileName: recordingFileName(session.startedDate, recordingFormat(mimeType)) });
  }

  function startTake(mode: "timed" | "manual") {
    const input = inputRef.current;
    if (!input || sessionRef.current?.recorder.state === "recording") return;
    wakeMeters(input);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;

    const mimeSupport = Object.fromEntries(MIME_CANDIDATES.map((type) => [type, MediaRecorder.isTypeSupported(type)])) as Record<MimeCandidate, boolean>;
    const requested = chooseMimeType(mimeSupport);
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(input.stream, requested ? { mimeType: requested } : undefined);
    } catch (error) {
      setTake({ phase: "failed", error: errorName(error) });
      return;
    }
    const session: Session = {
      recorder,
      input,
      mode,
      chunks: [],
      chunkEvents: 0,
      events: [],
      startedAt: performance.now(),
      startedDate: new Date(),
      reason: null,
      requested,
      mimeSupport,
      timer: null,
      ticker: 0,
    };
    recorder.addEventListener("dataavailable", (event) => {
      session.chunkEvents += 1;
      if (event.data.size > 0) session.chunks.push(event.data);
    });
    recorder.addEventListener("error", (event) => {
      note("recorder-error", errorName((event as Event & { error?: unknown }).error));
      session.reason ??= "recorder-error";
    });
    recorder.addEventListener("pause", () => note("recorder-pause"));
    recorder.addEventListener("resume", () => note("recorder-resume"));
    recorder.addEventListener("stop", () => void finishTake(session));
    try {
      recorder.start(TIMESLICE_MS);
    } catch (error) {
      setTake({ phase: "failed", error: errorName(error) });
      return;
    }
    sessionRef.current = session;
    if (mode === "timed") session.timer = window.setTimeout(() => stopTake("timer"), TIMED_MS);
    session.ticker = window.setInterval(() => setTake(recordingView(session)), 250);
    setTake(recordingView(session));
  }

  const onDeviceChange = useEffectEvent(async () => {
    note("device-change");
    const input = inputRef.current;
    if (!input) return;
    input.devices = await listInputs();
    if (inputRef.current === input) setMic({ phase: "live", input: { ...input } });
  });
  const onVisibilityChange = useEffectEvent(() => {
    const visible = document.visibilityState !== "hidden";
    if (visible) wakeMeters(inputRef.current);
    note(visible ? "page-visible" : "page-hidden");
  });
  const onUnmount = useEffectEvent(() => {
    latestOpenRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      clearInterval(session.ticker);
      if (session.timer !== null) clearTimeout(session.timer);
      if (session.recorder.state !== "inactive") session.recorder.stop();
    }
    closeInput(inputRef.current);
    inputRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  });

  useEffect(() => {
    const devices = navigator.mediaDevices;
    const deviceChange = () => void onDeviceChange();
    const visibilityChange = () => onVisibilityChange();
    devices?.addEventListener?.("devicechange", deviceChange);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      devices?.removeEventListener?.("devicechange", deviceChange);
      document.removeEventListener("visibilitychange", visibilityChange);
      onUnmount();
    };
  }, []);

  const missing = support ? missingFeatures(support) : [];
  const recording = take.phase === "recording";
  const live = mic.phase === "live" ? mic.input : null;
  const canRecord = !!live && !!support?.mediaRecorder && take.phase !== "processing";

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-h4 font-semibold text-text">시작 전에</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-text-muted">
          <li>믹서의 USB 단자와 폰을 데이터 케이블로 연결해요. 충전 전용 케이블로는 소리가 넘어가지 않아요.</li>
          <li>합주실 스피커는 끄고 믹서에만 소리를 넣어요. 그래야 폰 마이크로 들어온 소리와 헷갈리지 않아요.</li>
          <li>아이폰이라면 같은 믹서를 음성 메모로 먼저 녹음해 봐요. 음성 메모에 믹서 소리가 담겨야 브라우저 결과와 비교할 수 있어요.</li>
        </ol>
        <InlineNotice className="mt-3">
          장치 목록에 USB 이름이 보이거나 녹음이 끝까지 됐다고 해서 믹서 소리가 담긴 것은 아니에요. 꼭 재생해서 들어 봐요.
        </InlineNotice>
      </Card>

      {missing.length > 0 && (
        <InlineNotice tone="warning">
          이 브라우저에서 안 되는 것: {missing.map((feature) => PLATFORM_FEATURES[feature]).join(", ")}
        </InlineNotice>
      )}

      <Step title="1. 입력 장치">
        {(mic.phase === "idle" || mic.phase === "opening") && (
          <Button fullWidth loading={mic.phase === "opening"} disabled={!support?.getUserMedia} onClick={() => void openInput(null)}>
            마이크 권한 받기
          </Button>
        )}
        {mic.phase === "failed" &&
          (mic.error === "NotFoundError" ? (
            <EmptyState
              size="inline"
              title="입력 장치가 없어요"
              description="믹서 케이블을 꽂고 다시 찾아요."
              action={
                <Button variant="tonal" size="sm" onClick={() => void openInput(null)}>
                  다시 찾기
                </Button>
              }
            />
          ) : (
            <>
              <InlineNotice tone="warning">{micErrorMessage(mic.error)}</InlineNotice>
              <Button variant="tonal" fullWidth onClick={() => void openInput(null)}>
                다시 시도
              </Button>
            </>
          ))}
        {mic.phase === "lost" && (
          <>
            <InlineNotice tone="warning">입력이 끊겼어요. 케이블을 확인하고 다시 연결해요.</InlineNotice>
            <Button variant="tonal" fullWidth onClick={() => void openInput(null)}>
              다시 연결
            </Button>
          </>
        )}
        {live && (
          <>
            {live.devices.length === 0 ? (
              <p className="text-sm text-text-muted">브라우저가 장치 목록을 주지 않아요. 지금 쓰는 입력: {live.track.label || "이름 없음"}</p>
            ) : (
              <div role="radiogroup" aria-label="입력 장치">
                {live.devices.map((device, i) => (
                  <ListRowButton
                    key={device.deviceId || i}
                    role="radio"
                    aria-checked={i === live.index}
                    disabled={recording}
                    onClick={() => i !== live.index && void openInput(device.deviceId)}
                    trailing={i === live.index ? <CheckIcon /> : null}
                  >
                    <span className="block truncate text-body text-text">{device.label || `입력 ${i + 1}`}</span>
                  </ListRowButton>
                ))}
              </div>
            )}
            <SettingBadges settings={live.settings} />
            {live.analysers.length > 0 && <LevelMeters analysers={live.analysers} />}
          </>
        )}
      </Step>

      <Step title="2. 녹음">
        {support && !support.mediaRecorder ? (
          <InlineNotice tone="warning">이 브라우저는 녹음(MediaRecorder)을 지원하지 않아요. 입력 레벨만 확인할 수 있어요.</InlineNotice>
        ) : (
          <>
            <ButtonGroup>
              <Button variant="tonal" disabled={!canRecord || recording} onClick={() => startTake("timed")}>
                10초 녹음
              </Button>
              <Button
                variant="tonal"
                pressed={recording}
                disabled={!canRecord}
                onClick={() => (recording ? stopTake("user") : startTake("manual"))}
              >
                {recording ? "녹음 정지" : "녹음 시작"}
              </Button>
            </ButtonGroup>
            {!live && take.phase === "idle" && <p className="text-sm text-text-muted">먼저 입력 장치를 열어요.</p>}
            {recording && (
              <div>
                <p className="text-sm tabular-nums text-text">
                  {formatRuntime(take.elapsedMs / 1000)} 녹음 중 · 조각 {take.chunks}개{take.mode === "timed" && " · 10초 뒤 멈춰요"}
                </p>
                {take.events.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-text-muted">
                    {take.events.map((event, i) => (
                      <li key={i} className="tabular-nums">
                        {formatRuntime(event.atMs / 1000)} {RECORDING_EVENTS[event.type]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {take.phase === "processing" && <p className="text-sm text-text-muted">파일을 다시 읽고 있어요.</p>}
            {take.phase === "failed" && <InlineNotice tone="warning">녹음을 시작하지 못했어요 ({take.error}).</InlineNotice>}
          </>
        )}
      </Step>

      {take.phase === "done" && (
        <Step title="3. 결과">
          <RecordingResult
            key={take.url}
            check={take.check}
            url={take.url}
            fileName={take.fileName}
            onPlayerSeconds={(seconds) =>
              setTake((current) => (current.phase === "done" ? { ...current, check: { ...current.check, playerSeconds: seconds } } : current))
            }
          />
        </Step>
      )}
    </div>
  );
}
