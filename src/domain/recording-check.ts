import { formatRuntime } from "./setlist";

export const MIME_CANDIDATES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

export type MimeCandidate = (typeof MIME_CANDIDATES)[number];
export type MimeSupport = Readonly<Record<MimeCandidate, boolean>>;

// The codec-pinned form leads so a browser that would put Opus in plain audio/mp4 still records AAC.
const MIME_PREFERENCE: readonly MimeCandidate[] = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

/** The mimeType to ask MediaRecorder for, or null to let the browser use its default. */
export function chooseMimeType(support: MimeSupport): MimeCandidate | null {
  return MIME_PREFERENCE.find((type) => support[type]) ?? null;
}

export interface RecordingFormat {
  extension: "m4a" | "webm" | "ogg";
  contentType: "audio/mp4" | "audio/webm" | "audio/ogg";
}

const FORMATS: ReadonlyMap<string, RecordingFormat> = new Map([
  ["mp4", { extension: "m4a", contentType: "audio/mp4" }],
  ["webm", { extension: "webm", contentType: "audio/webm" }],
  ["ogg", { extension: "ogg", contentType: "audio/ogg" }],
]);

/**
 * Reads the mimeType the recorder reports after it ran (not the one asked for).
 * Null for a container this check does not know.
 */
export function recordingFormat(mimeType: string): RecordingFormat | null {
  const [type, subtype = ""] = mimeType.split(";", 1)[0].trim().toLowerCase().split("/");
  if (type !== "audio") return null;
  return FORMATS.get(subtype) ?? null;
}

export function recordingFileName(startedAt: Date, format: RecordingFormat | null): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const day = `${startedAt.getFullYear()}${two(startedAt.getMonth() + 1)}${two(startedAt.getDate())}`;
  const time = `${two(startedAt.getHours())}${two(startedAt.getMinutes())}${two(startedAt.getSeconds())}`;
  return `plypick-recording-${day}-${time}.${format?.extension ?? "bin"}`;
}

export const MUSIC_AUDIO = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
} as const;

export function audioConstraints(deviceId: string | null) {
  return deviceId ? { ...MUSIC_AUDIO, deviceId: { exact: deviceId } } : { ...MUSIC_AUDIO };
}

export interface AudioSettings {
  sampleRate?: number;
  channelCount?: number;
  // The spec now also allows "all" and "remote-only" here.
  echoCancellation?: boolean | string;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  latency?: number;
}

export type AudioSettingKey = keyof AudioSettings;

const SETTING_TYPES: Readonly<Record<AudioSettingKey, readonly string[]>> = {
  sampleRate: ["number"],
  channelCount: ["number"],
  echoCancellation: ["boolean", "string"],
  noiseSuppression: ["boolean"],
  autoGainControl: ["boolean"],
  latency: ["number"],
};

export const AUDIO_SETTING_KEYS = Object.keys(SETTING_TYPES) as AudioSettingKey[];

export function pickAudioSettings(raw: object): AudioSettings {
  const source = raw as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of AUDIO_SETTING_KEYS) {
    if (SETTING_TYPES[key].includes(typeof source[key])) picked[key] = source[key];
  }
  return picked as AudioSettings;
}

export type Capability = { min?: number; max?: number } | readonly (boolean | string)[];
export type AudioCapabilities = Partial<Record<AudioSettingKey, Capability>>;

export function pickAudioCapabilities(raw: object): AudioCapabilities {
  const source = raw as Record<string, unknown>;
  const picked: AudioCapabilities = {};
  for (const key of AUDIO_SETTING_KEYS) {
    const value = source[key];
    if (Array.isArray(value)) {
      picked[key] = value.filter((v): v is boolean | string => typeof v === "boolean" || typeof v === "string");
    } else if (value && typeof value === "object") {
      const { min, max } = value as { min?: unknown; max?: unknown };
      picked[key] = { ...(typeof min === "number" && { min }), ...(typeof max === "number" && { max }) };
    }
  }
  return picked;
}

export type MicPermission = "granted" | "denied" | "prompt" | "unknown";

export function parseMicPermission(state: string | undefined): MicPermission {
  return state === "granted" || state === "denied" || state === "prompt" ? state : "unknown";
}

export const PLATFORM_FEATURES = {
  secureContext: "HTTPS 연결",
  getUserMedia: "마이크 입력 (getUserMedia)",
  mediaRecorder: "녹음 (MediaRecorder)",
  audioContext: "입력 레벨·파일 다시 읽기 (AudioContext)",
} as const;

export type PlatformFeature = keyof typeof PLATFORM_FEATURES;
export type PlatformSupport = Readonly<Record<PlatformFeature, boolean>>;

export function missingFeatures(support: PlatformSupport): PlatformFeature[] {
  return (Object.keys(PLATFORM_FEATURES) as PlatformFeature[]).filter((feature) => !support[feature]);
}

const MIC_ERRORS: Readonly<Record<string, string>> = {
  NotAllowedError:
    "마이크를 쓰지 못하게 막혀 있어요. 권한을 거절했다면 브라우저의 사이트 설정에서 마이크를 허용하고 다시 눌러요. 앱 안 브라우저라면 앱이 막고 있을 수 있어요.",
  NotFoundError: "입력 장치를 찾지 못했어요. 케이블을 다시 꽂고 눌러요.",
  NotReadableError: "입력 장치를 열지 못했어요. 통화나 녹음 중인 다른 앱을 닫고 다시 눌러요.",
  OverconstrainedError: "고른 장치가 사라졌어요. 케이블을 확인하고 다시 눌러요.",
  SecurityError: "이 주소에서는 마이크를 쓸 수 없어요. https:// 주소로 열었는지 확인해요.",
};

export function micErrorMessage(errorName: string): string {
  return MIC_ERRORS[errorName] ?? `마이크를 열지 못했어요 (${errorName || "알 수 없는 오류"}). 다시 눌러요.`;
}

export const RECORDING_EVENTS = {
  "track-ended": "입력 끊김",
  "track-mute": "입력 멈춤",
  "track-unmute": "입력 다시 들어옴",
  "device-change": "장치 목록 바뀜",
  "page-hidden": "화면 숨김",
  "page-visible": "화면 돌아옴",
  "recorder-error": "녹음기 오류",
  "recorder-pause": "녹음기 일시정지",
  "recorder-resume": "녹음기 다시 시작",
} as const;

export type RecordingEventType = keyof typeof RECORDING_EVENTS;

export interface RecordingEvent {
  type: RecordingEventType;
  /** Milliseconds since the recording started. */
  atMs: number;
  detail?: string;
}

export const STOP_REASONS = {
  user: "직접 정지",
  timer: "10초 끝",
  "input-ended": "입력이 끊겨 멈춤",
  "recorder-error": "녹음기 오류로 멈춤",
  browser: "브라우저가 멈춤",
} as const;

export type StopReason = keyof typeof STOP_REASONS;

/** Every dB value is clamped here: JSON.stringify writes -Infinity as null. */
export const FLOOR_DB = -90;
const SILENT_DB = -60;
export const METER_RANGE_DB = 60;
export const CLIP_DB = -1;
const SAME_SIGNAL_RATIO = 10 ** (-40 / 20);

export function toDb(amplitude: number): number {
  return amplitude > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(amplitude)) : FLOOR_DB;
}

export function peakDb(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return toDb(peak);
}

export function meterLevel(db: number): number {
  return Math.min(1, Math.max(0, (db + METER_RANGE_DB) / METER_RANGE_DB));
}

export function formatDb(db: number): string {
  return db <= -METER_RANGE_DB ? "무음" : `${Math.round(db)} dB`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function channelLabels(count: number): string[] {
  if (count === 1) return ["모노"];
  if (count === 2) return ["L", "R"];
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

export type StereoImage = "dual-mono" | "distinct";

export interface ChannelReport {
  peakDb: number[];
  /** Null unless there are exactly two channels and at least one carries signal. */
  stereo: StereoImage | null;
}

export function analyzeChannels(channels: readonly ArrayLike<number>[]): ChannelReport {
  const peaks = channels.map(peakDb);
  if (channels.length !== 2 || peaks.every((db) => db < SILENT_DB)) return { peakDb: peaks, stereo: null };
  const [left, right] = channels;
  let sumLeft = 0;
  let sumRight = 0;
  let sumDiff = 0;
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    sumLeft += left[i] * left[i];
    sumRight += right[i] * right[i];
    sumDiff += (left[i] - right[i]) ** 2;
  }
  const louder = Math.sqrt(Math.max(sumLeft, sumRight));
  return { peakDb: peaks, stereo: Math.sqrt(sumDiff) <= louder * SAME_SIGNAL_RATIO ? "dual-mono" : "distinct" };
}

/**
 * decodeAudioData holds the whole file as 32-bit samples (a 2-hour stereo take is about 2.7 GB), which would crash
 * a phone's tab and lose the result.
 */
export const DECODE_LIMIT_MS = 5 * 60 * 1000;

export type DecodedAudio =
  | ({ status: "decoded"; channels: number; sampleRate: number; durationSec: number } & ChannelReport)
  | { status: "failed"; error: string }
  | { status: "skipped"; reason: "too-long" | "empty" };

/** The client hints Chromium browsers give on request. Chrome's user agent string freezes Android at "10; K". */
export interface ClientHints {
  platform?: string;
  platformVersion?: string;
  model?: string;
}

export interface RecordingCheck {
  userAgent: string;
  clientHints: ClientHints | null;
  support: PlatformSupport;
  permission: MicPermission;
  device: {
    /** Position of the input used in the list below, or null when the browser does not say which one it opened. */
    index: number | null;
    label: string;
    listed: string[];
  };
  requested: { audio: typeof MUSIC_AUDIO; device: "default" | "chosen"; mimeType: MimeCandidate | null };
  settings: AudioSettings;
  /** Null where the browser has no getCapabilities. */
  capabilities: AudioCapabilities | null;
  mimeSupport: MimeSupport;
  /** What the recorder reports after recording, which can differ from the one requested. */
  mimeType: string;
  file: { bytes: number; chunks: number; wallMs: number };
  decoded: DecodedAudio;
  /** The audio player's length for the file: absent until it has loaded, null when it reads no finite length. */
  playerSeconds?: number | null;
  events: RecordingEvent[];
  stoppedBy: StopReason;
}

export type MixerVerdict = "unchecked" | "mixer" | "not-mixer";

const VERDICT_CELL: Readonly<Record<MixerVerdict, string>> = { unchecked: "확인 전", mixer: "O", "not-mixer": "X" };

interface Matcher {
  name: string;
  pattern: RegExp;
}

// First match wins: in-app and vendor browsers also carry the Chrome or Safari token they are built on.
const BROWSERS: readonly Matcher[] = [
  { name: "카카오톡", pattern: /KAKAOTALK[ /]([\d.]+)/i },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/ },
  { name: "Whale", pattern: /Whale\/([\d.]+)/ },
  { name: "Edge", pattern: /Edg(?:A|iOS)?\/([\d.]+)/ },
  { name: "Chrome", pattern: /CriOS\/([\d.]+)/ },
  { name: "Firefox", pattern: /FxiOS\/([\d.]+)/ },
  { name: "Chrome", pattern: /Chrome\/([\d.]+)/ },
  { name: "Firefox", pattern: /Firefox\/([\d.]+)/ },
  { name: "Safari", pattern: /Version\/([\d.]+).*Safari/ },
];

const SYSTEMS: readonly Matcher[] = [
  { name: "iOS", pattern: /(?:iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/ },
  { name: "Android", pattern: /Android ([\d.]+)/ },
  { name: "macOS", pattern: /Mac OS X (\d+(?:[_.]\d+)*)/ },
  { name: "Windows", pattern: /Windows NT ([\d.]+)/ },
];

function shortVersion(version: string): string {
  return version.split(/[._]/).slice(0, 2).join(".");
}

function firstMatch(matchers: readonly Matcher[], userAgent: string): string | null {
  for (const { name, pattern } of matchers) {
    const version = pattern.exec(userAgent)?.[1];
    if (version) return `${name} ${shortVersion(version)}`;
  }
  return null;
}

export function describeClient(userAgent: string, hints: ClientHints | null): string {
  const browser = firstMatch(BROWSERS, userAgent) ?? "알 수 없는 브라우저";
  const system =
    hints?.platform && hints.platformVersion
      ? `${hints.platform} ${shortVersion(hints.platformVersion)}`
      : firstMatch(SYSTEMS, userAgent);
  return [browser, system, hints?.model || null].filter(Boolean).join(" · ");
}

function eventSummary(events: readonly RecordingEvent[]): string {
  if (events.length === 0) return "이벤트 없음";
  const counts = new Map<RecordingEventType, number>();
  for (const { type } of events) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts].map(([type, n]) => `${RECORDING_EVENTS[type]} ${n}회`).join(", ");
}

function channelCell(check: RecordingCheck): string {
  const track = check.settings.channelCount;
  const trackNote = track === undefined ? "" : ` (트랙 ${track})`;
  const { decoded } = check;
  if (decoded.status === "failed") return `파일 못 읽음${trackNote}`;
  if (decoded.status === "skipped") return `파일 확인 안 함${trackNote}`;
  const stereo = decoded.stereo === "dual-mono" ? " · 좌우 같음" : decoded.stereo === "distinct" ? " · 좌우 다름" : "";
  const silent = decoded.peakDb.every((db) => db < SILENT_DB) ? " · 무음" : "";
  return `${decoded.channels}${stereo}${silent}${trackNote}`;
}

function formatCell(check: RecordingCheck): string {
  const rate = check.settings.sampleRate;
  return [check.mimeType || "(빈 값)", rate ? `${rate}Hz` : null].filter(Boolean).join(" · ");
}

function durationCell(check: RecordingCheck): string {
  const stop = check.stoppedBy === "user" || check.stoppedBy === "timer" ? [] : [STOP_REASONS[check.stoppedBy]];
  return [formatRuntime(check.file.wallMs / 1000), ...stop, eventSummary(check.events)].join(" · ");
}

function cell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

export const RESULT_TABLE_HEADER = "| 조합 | USB 입력 | 실제 채널 수 | 포맷 | 장시간 |\n|---|---|---|---|---|";

export function resultRow(check: RecordingCheck, verdict: MixerVerdict): string {
  const input = `${VERDICT_CELL[verdict]} (${check.device.label || "이름 없음"})`;
  const cells = [describeClient(check.userAgent, check.clientHints), input, channelCell(check), formatCell(check), durationCell(check)];
  return `| ${cells.map(cell).join(" | ")} |`;
}

export function resultMarkdown(check: RecordingCheck, verdict: MixerVerdict): string {
  return [
    RESULT_TABLE_HEADER,
    resultRow(check, verdict),
    "",
    "<details><summary>녹음 점검 상세 (JSON)</summary>",
    "",
    "```json",
    JSON.stringify(check, null, 2),
    "```",
    "",
    "</details>",
  ].join("\n");
}
