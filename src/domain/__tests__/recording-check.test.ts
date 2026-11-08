import { describe, expect, it } from "vitest";
import {
  analyzeChannels,
  audioConstraints,
  chooseMimeType,
  describeClient,
  formatBytes,
  formatDb,
  meterLevel,
  micErrorMessage,
  MIME_CANDIDATES,
  missingFeatures,
  parseMicPermission,
  peakDb,
  pickAudioCapabilities,
  pickAudioSettings,
  recordingFileName,
  recordingFormat,
  resultMarkdown,
  resultRow,
  type MimeCandidate,
  type MimeSupport,
  type RecordingCheck,
} from "../recording-check";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
  iosKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.6.0",
  androidChrome: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 15; SAMSUNG SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  androidKakao:
    "Mozilla/5.0 (Linux; Android 15; SM-S928N Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.157 Mobile Safari/537.36;KAKAOTALK 2512550",
};

function support(...supported: MimeCandidate[]): MimeSupport {
  return Object.fromEntries(MIME_CANDIDATES.map((type) => [type, supported.includes(type)])) as Record<MimeCandidate, boolean>;
}

describe("chooseMimeType", () => {
  it.each([
    { browser: "every candidate", supported: [...MIME_CANDIDATES], expected: "audio/mp4;codecs=mp4a.40.2" },
    { browser: "MP4 without the AAC codec string", supported: ["audio/mp4", "audio/webm;codecs=opus"], expected: "audio/mp4" },
    { browser: "WebM only", supported: ["audio/webm", "audio/webm;codecs=opus"], expected: "audio/webm;codecs=opus" },
    { browser: "WebM without the codec string", supported: ["audio/webm"], expected: "audio/webm" },
    { browser: "Ogg only", supported: ["audio/ogg;codecs=opus"], expected: "audio/ogg;codecs=opus" },
    { browser: "none", supported: [], expected: null },
  ] as const)("$browser → $expected", ({ supported, expected }) => {
    expect(chooseMimeType(support(...supported))).toBe(expected);
  });
});

describe("recordingFormat", () => {
  it.each([
    { mime: "audio/mp4", expected: { extension: "m4a", contentType: "audio/mp4" } },
    { mime: "audio/mp4;codecs=mp4a.40.2", expected: { extension: "m4a", contentType: "audio/mp4" } },
    { mime: "video/mp4", expected: null },
    { mime: "audio/webm;codecs=opus", expected: { extension: "webm", contentType: "audio/webm" } },
    { mime: "AUDIO/WEBM; codecs=opus", expected: { extension: "webm", contentType: "audio/webm" } },
    { mime: "audio/ogg; codecs=opus", expected: { extension: "ogg", contentType: "audio/ogg" } },
    { mime: "", expected: null },
    { mime: "audio/wav", expected: null },
    { mime: "text/plain", expected: null },
    { mime: "audio/constructor", expected: null },
  ])("$mime → $expected", ({ mime, expected }) => {
    expect(recordingFormat(mime)).toEqual(expected);
  });
});

describe("recordingFileName", () => {
  it("stamps the local start time and takes the extension of the recorded container", () => {
    const at = new Date(2026, 10, 8, 9, 5, 3);
    expect(recordingFileName(at, recordingFormat("audio/mp4"))).toBe("plypick-recording-20261108-090503.m4a");
    expect(recordingFileName(at, recordingFormat("audio/webm;codecs=opus"))).toBe("plypick-recording-20261108-090503.webm");
    expect(recordingFileName(at, null)).toBe("plypick-recording-20261108-090503.bin");
  });
});

describe("audioConstraints", () => {
  const music = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } };

  it("turns voice processing off and asks for two channels", () => {
    expect(audioConstraints(null)).toEqual(music);
  });

  it("pins a picked device exactly", () => {
    expect(audioConstraints("usb-1")).toEqual({ ...music, deviceId: { exact: "usb-1" } });
  });
});

describe("pickAudioSettings", () => {
  it("keeps the reported audio fields and drops the ids that identify the phone", () => {
    const chrome = {
      deviceId: "f3c1",
      groupId: "9a2e",
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 2,
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0.01,
    };
    expect(pickAudioSettings(chrome)).toEqual({
      sampleRate: 48000,
      channelCount: 2,
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0.01,
    });
  });

  it("keeps the newer string form of echoCancellation and drops values of the wrong type", () => {
    expect(pickAudioSettings({ echoCancellation: "remote-only", sampleRate: "48000", channelCount: null })).toEqual({ echoCancellation: "remote-only" });
  });
});

describe("pickAudioCapabilities", () => {
  it("keeps number ranges and allowed-value lists", () => {
    const raw = {
      deviceId: "f3c1",
      sampleRate: { min: 8000, max: 96000 },
      channelCount: { min: 1, max: 2 },
      echoCancellation: [true, false],
      autoGainControl: [false],
      latency: { min: 0.01, max: 0.2 },
    };
    expect(pickAudioCapabilities(raw)).toEqual({
      sampleRate: { min: 8000, max: 96000 },
      channelCount: { min: 1, max: 2 },
      echoCancellation: [true, false],
      autoGainControl: [false],
      latency: { min: 0.01, max: 0.2 },
    });
  });
});

describe("parseMicPermission", () => {
  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["prompt", "prompt"],
    [undefined, "unknown"],
    ["blocked", "unknown"],
  ] as const)("%s → %s", (state, expected) => {
    expect(parseMicPermission(state)).toBe(expected);
  });
});

describe("missingFeatures", () => {
  const all = { secureContext: true, getUserMedia: true, mediaRecorder: true, audioContext: true };

  it.each([
    { case: "a current browser", support: all, missing: [] },
    { case: "old iOS without MediaRecorder", support: { ...all, mediaRecorder: false }, missing: ["mediaRecorder"] },
    { case: "plain http", support: { ...all, secureContext: false, getUserMedia: false }, missing: ["secureContext", "getUserMedia"] },
  ])("$case → $missing", ({ support, missing }) => {
    expect(missingFeatures(support)).toEqual(missing);
  });
});

describe("micErrorMessage", () => {
  it.each([
    ["NotAllowedError", /사이트 설정/],
    ["NotFoundError", /케이블/],
    ["NotReadableError", /다른 앱/],
    ["OverconstrainedError", /장치가 사라졌어요/],
    ["SecurityError", /https/],
    ["WeirdError", /WeirdError/],
    ["", /알 수 없는 오류/],
  ])("%s tells what to do", (name, message) => {
    expect(micErrorMessage(name)).toMatch(message);
  });
});

describe("levels", () => {
  it.each([
    { samples: [0.5, -0.25], db: -6.02 },
    { samples: [-1, 0.2], db: 0 },
    { samples: [0, 0], db: -90 },
    { samples: [], db: -90 },
    { samples: [1e-9], db: -90 },
  ])("peak of $samples is $db dBFS", ({ samples, db }) => {
    expect(peakDb(samples)).toBeCloseTo(db, 2);
  });

  it.each([
    { db: -90, level: 0 },
    { db: -60, level: 0 },
    { db: -30, level: 0.5 },
    { db: 0, level: 1 },
    { db: 3, level: 1 },
  ])("a meter at $db dB is $level full", ({ db, level }) => {
    expect(meterLevel(db)).toBe(level);
  });

  it.each([
    { db: -90, text: "무음" },
    { db: -60, text: "무음" },
    { db: -12.4, text: "-12 dB" },
    { db: 0, text: "0 dB" },
  ])("$db dB reads $text", ({ db, text }) => {
    expect(formatDb(db)).toBe(text);
  });

  it.each([
    { bytes: 0, text: "0 B" },
    { bytes: 999, text: "999 B" },
    { bytes: 161_234, text: "161 KB" },
    { bytes: 8_640_000, text: "8.6 MB" },
  ])("$bytes bytes reads $text", ({ bytes, text }) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("analyzeChannels", () => {
  const tone = Array.from({ length: 480 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * i) / 48));
  const silence = tone.map(() => 0);

  it.each([
    { case: "a mono file", channels: [tone], stereo: null },
    { case: "a mono input copied to both sides", channels: [tone, tone], stereo: "dual-mono" },
    { case: "the same signal under -100 dB of codec noise", channels: [tone, tone.map((s, i) => s + (i % 2 ? 1e-5 : -1e-5))], stereo: "dual-mono" },
    { case: "a signal panned hard left", channels: [tone, silence], stereo: "distinct" },
    { case: "a signal panned part way", channels: [tone, tone.map((s) => s * 0.5)], stereo: "distinct" },
    { case: "two silent channels", channels: [silence, silence], stereo: null },
  ])("$case → $stereo", ({ channels, stereo }) => {
    expect(analyzeChannels(channels).stereo).toBe(stereo);
  });

  it("reports each channel's peak", () => {
    const [left, right] = analyzeChannels([tone, silence]).peakDb;
    expect(left).toBeCloseTo(-6.02, 1);
    expect(right).toBe(-90);
  });
});

describe("describeClient", () => {
  it.each([
    { case: "iPhone Safari", ua: UA.iosSafari, hints: null, expected: "Safari 18.5 · iOS 18.5" },
    { case: "iPhone Chrome", ua: UA.iosChrome, hints: null, expected: "Chrome 138.0 · iOS 18.5" },
    { case: "KakaoTalk on iPhone", ua: UA.iosKakao, hints: null, expected: "카카오톡 25.6 · iOS 18.5" },
    {
      case: "Galaxy Chrome with client hints",
      ua: UA.androidChrome,
      hints: { platform: "Android", platformVersion: "15.0.0", model: "SM-S928N" },
      expected: "Chrome 138.0 · Android 15.0 · SM-S928N",
    },
    { case: "Galaxy Chrome without hints keeps the frozen version", ua: UA.androidChrome, hints: null, expected: "Chrome 138.0 · Android 10" },
    { case: "Samsung Internet", ua: UA.samsung, hints: null, expected: "Samsung Internet 28.0 · Android 15" },
    { case: "KakaoTalk on Galaxy", ua: UA.androidKakao, hints: null, expected: "카카오톡 2512550 · Android 15" },
    { case: "an unknown client", ua: "curl/8.7.1", hints: null, expected: "알 수 없는 브라우저" },
  ])("$case → $expected", ({ ua, hints, expected }) => {
    expect(describeClient(ua, hints)).toBe(expected);
  });
});

const SAFARI_TAKE: RecordingCheck = {
  userAgent: UA.iosSafari,
  clientHints: null,
  support: { secureContext: true, getUserMedia: true, mediaRecorder: true, audioContext: true },
  permission: "granted",
  device: { index: 1, label: "USB Audio CODEC", listed: ["iPhone 마이크", "USB Audio CODEC"] },
  requested: {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } },
    device: "chosen",
    mimeType: "audio/mp4;codecs=mp4a.40.2",
  },
  settings: { sampleRate: 48000, channelCount: 2, echoCancellation: false },
  capabilities: null,
  mimeSupport: support("audio/mp4", "audio/mp4;codecs=mp4a.40.2"),
  mimeType: "audio/mp4",
  file: { bytes: 161_234, chunks: 10, wallMs: 10_050 },
  decoded: { status: "decoded", channels: 2, sampleRate: 48000, durationSec: 10.02, peakDb: [-12, -14], stereo: "distinct" },
  playerSeconds: 10.02,
  events: [],
  stoppedBy: "timer",
};

describe("resultRow", () => {
  it.each([
    {
      case: "a 10-second take the operator heard as the mixer",
      check: SAFARI_TAKE,
      verdict: "mixer",
      row: "| Safari 18.5 · iOS 18.5 | O (USB Audio CODEC) | 2 · 좌우 다름 (트랙 2) | audio/mp4 · 48000Hz | 0:10 · 이벤트 없음 |",
    },
    {
      case: "a take not yet listened to",
      check: SAFARI_TAKE,
      verdict: "unchecked",
      row: "| Safari 18.5 · iOS 18.5 | 확인 전 (USB Audio CODEC) | 2 · 좌우 다름 (트랙 2) | audio/mp4 · 48000Hz | 0:10 · 이벤트 없음 |",
    },
    {
      case: "the phone's own mic, mono copied to both sides",
      check: {
        ...SAFARI_TAKE,
        device: { ...SAFARI_TAKE.device, label: "iPhone 마이크" },
        settings: { sampleRate: 48000, channelCount: 1 },
        decoded: { status: "decoded", channels: 2, sampleRate: 48000, durationSec: 10, peakDb: [-20, -20], stereo: "dual-mono" },
      },
      verdict: "not-mixer",
      row: "| Safari 18.5 · iOS 18.5 | X (iPhone 마이크) | 2 · 좌우 같음 (트랙 1) | audio/mp4 · 48000Hz | 0:10 · 이벤트 없음 |",
    },
    {
      case: "a long take cut by an unplugged cable after the screen locked",
      check: {
        ...SAFARI_TAKE,
        mimeType: "audio/webm;codecs=opus",
        file: { bytes: 9_000_000, chunks: 1_871, wallMs: 1_871_400 },
        decoded: { status: "skipped", reason: "too-long" },
        events: [
          { type: "page-hidden", atMs: 600_000 },
          { type: "page-visible", atMs: 900_000 },
          { type: "page-hidden", atMs: 1_200_000 },
          { type: "track-ended", atMs: 1_871_000 },
        ],
        stoppedBy: "input-ended",
      },
      verdict: "mixer",
      row: "| Safari 18.5 · iOS 18.5 | O (USB Audio CODEC) | 파일 확인 안 함 (트랙 2) | audio/webm;codecs=opus · 48000Hz | 31:11 · 입력이 끊겨 멈춤 · 화면 숨김 2회, 화면 돌아옴 1회, 입력 끊김 1회 |",
    },
    {
      case: "a file the browser cannot decode, from an input with no name or sample rate",
      check: {
        ...SAFARI_TAKE,
        device: { index: null, label: "", listed: [] },
        settings: {},
        mimeType: "",
        decoded: { status: "failed", error: "EncodingError" },
      },
      verdict: "unchecked",
      row: "| Safari 18.5 · iOS 18.5 | 확인 전 (이름 없음) | 파일 못 읽음 | (빈 값) | 0:10 · 이벤트 없음 |",
    },
    {
      case: "a device name that would break the table",
      check: { ...SAFARI_TAKE, device: { ...SAFARI_TAKE.device, label: "Mixer | Main\nOut" } },
      verdict: "mixer",
      row: "| Safari 18.5 · iOS 18.5 | O (Mixer \\| Main Out) | 2 · 좌우 다름 (트랙 2) | audio/mp4 · 48000Hz | 0:10 · 이벤트 없음 |",
    },
    {
      case: "a silent take",
      check: { ...SAFARI_TAKE, decoded: { status: "decoded", channels: 2, sampleRate: 48000, durationSec: 10, peakDb: [-90, -90], stereo: null } },
      verdict: "not-mixer",
      row: "| Safari 18.5 · iOS 18.5 | X (USB Audio CODEC) | 2 · 무음 (트랙 2) | audio/mp4 · 48000Hz | 0:10 · 이벤트 없음 |",
    },
  ] as const)("$case", ({ check, verdict, row }) => {
    expect(resultRow(check as RecordingCheck, verdict)).toBe(row);
  });
});

describe("resultMarkdown", () => {
  it("pastes as the issue's table with one row, then the whole result as JSON", () => {
    const text = resultMarkdown(SAFARI_TAKE, "mixer");
    const lines = text.split("\n");
    expect(lines.slice(0, 3)).toEqual([
      "| 조합 | USB 입력 | 실제 채널 수 | 포맷 | 장시간 |",
      "|---|---|---|---|---|",
      resultRow(SAFARI_TAKE, "mixer"),
    ]);
    const json = /```json\n([\s\S]*?)\n```/.exec(text)?.[1];
    expect(JSON.parse(json ?? "")).toEqual(SAFARI_TAKE);
    expect(text.trimEnd().endsWith("</details>")).toBe(true);
  });
});
