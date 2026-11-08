// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecordingCheck from "../RecordingCheck";

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";

class FakeTrack extends EventTarget {
  kind = "audio";
  readyState: "live" | "ended" = "live";
  stopped = false;
  constructor(
    readonly label: string,
    private readonly deviceId: string,
  ) {
    super();
  }
  getSettings() {
    return { deviceId: this.deviceId, groupId: "g1", sampleRate: 48000, channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  }
  getCapabilities() {
    return { channelCount: { min: 1, max: 2 }, sampleRate: { min: 48000, max: 48000 } };
  }
  stop() {
    this.stopped = true;
    this.readyState = "ended";
  }
  unplug() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}

class FakeStream {
  constructor(readonly track: FakeTrack) {}
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

class FakeMediaRecorder extends EventTarget {
  static supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported(type: string) {
    return FakeMediaRecorder.supported.has(type);
  }
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  timeslice: number | undefined;
  constructor(
    readonly stream: FakeStream,
    options?: { mimeType?: string },
  ) {
    super();
    this.mimeType = options?.mimeType ?? "audio/webm";
    FakeMediaRecorder.instances.push(this);
  }
  start(timeslice?: number) {
    this.state = "recording";
    this.timeslice = timeslice;
  }
  chunk(bytes: number) {
    this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: new Blob([new Uint8Array(bytes)]) }));
  }
  stop() {
    if (this.state === "inactive") throw new DOMException("not recording", "InvalidStateError");
    this.state = "inactive";
    // Like a browser: the last piece, then stop, in a later task.
    setTimeout(() => {
      this.chunk(100);
      this.dispatchEvent(new Event("stop"));
    });
  }
}

const tone = Float32Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * i) / 48));

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static startState: "running" | "suspended" = "running";
  state: "running" | "suspended" | "closed" = FakeAudioContext.startState;
  resume() {
    if (this.state !== "closed") this.state = "running";
    return Promise.resolve();
  }
  sampleRate = 48000;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource() {
    return { connect() {} };
  }
  createChannelSplitter() {
    return { connect() {} };
  }
  createAnalyser() {
    return { fftSize: 2048, getFloatTimeDomainData: (buffer: Float32Array) => buffer.fill(0.25) };
  }
  async decodeAudioData() {
    return { numberOfChannels: 2, sampleRate: 48000, duration: 3, getChannelData: (i: number) => (i === 0 ? tone : tone.map((s) => s * 0.5)) };
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

const media = vi.hoisted(() => ({
  getUserMedia: vi.fn(),
  enumerateDevices: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
const clipboard = { writeText: vi.fn() };
const tracks: FakeTrack[] = [];

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
}

function grantWith(label: string, deviceId: string) {
  media.getUserMedia.mockImplementationOnce(async () => {
    const track = new FakeTrack(label, deviceId);
    tracks.push(track);
    return new FakeStream(track);
  });
}

beforeEach(() => {
  FakeMediaRecorder.instances = [];
  FakeAudioContext.instances = [];
  FakeAudioContext.startState = "running";
  tracks.length = 0;
  media.getUserMedia.mockReset();
  media.enumerateDevices.mockReset().mockResolvedValue([
    { kind: "audioinput", deviceId: "mic", label: "iPhone 마이크" },
    { kind: "audioinput", deviceId: "usb", label: "USB Audio CODEC" },
    { kind: "audiooutput", deviceId: "spk", label: "스피커" },
  ]);
  clipboard.writeText.mockReset().mockResolvedValue(undefined);
  define(navigator, "mediaDevices", media);
  define(navigator, "clipboard", clipboard);
  define(navigator, "permissions", { query: async () => ({ state: "granted" }) });
  define(navigator, "userAgent", ANDROID_CHROME);
  define(navigator, "userAgentData", {
    getHighEntropyValues: async () => ({ platform: "Android", platformVersion: "15.0.0", model: "SM-S928N" }),
  });
  define(window, "isSecureContext", true);
  define(window, "MediaRecorder", FakeMediaRecorder);
  define(window, "AudioContext", FakeAudioContext);
  define(URL, "createObjectURL", vi.fn(() => "blob:take"));
  define(URL, "revokeObjectURL", vi.fn());
});

afterEach(cleanup);

async function openUsbInput() {
  grantWith("USB Audio CODEC", "usb");
  render(<RecordingCheck />);
  fireEvent.click(screen.getByRole("button", { name: "마이크 권한 받기" }));
  expect(await screen.findByRole("radio", { name: "USB Audio CODEC" })).toHaveAttribute("aria-checked", "true");
}

function recorder() {
  return FakeMediaRecorder.instances.at(-1)!;
}

async function copiedRow() {
  fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));
  await screen.findByText(/복사했어요/);
  return (clipboard.writeText.mock.calls.at(-1)![0] as string).split("\n")[2];
}

describe("RecordingCheck", () => {
  it("asks for the mixer's signal untouched, then lists inputs with a meter per channel", async () => {
    await openUsbInput();

    expect(media.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } },
    });
    expect(screen.getByRole("radio", { name: "iPhone 마이크" })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("radio", { name: "스피커" })).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "L 입력 레벨" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "R 입력 레벨" })).toBeInTheDocument();
    expect(screen.getByText("에코 제거 끔")).toBeInTheDocument();
  });

  it("wakes a suspended meter after opening the input and when the page comes back", async () => {
    FakeAudioContext.startState = "suspended";
    await openUsbInput();
    const context = FakeAudioContext.instances.at(-1)!;
    expect(context.state).toBe("running");

    context.state = "suspended";
    fireEvent(document, new Event("visibilitychange"));
    expect(context.state).toBe("running");
  });

  it("explains a refused permission and offers to ask again", async () => {
    media.getUserMedia.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
    render(<RecordingCheck />);
    fireEvent.click(screen.getByRole("button", { name: "마이크 권한 받기" }));

    expect(await screen.findByText(/사이트 설정에서 마이크를 허용/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "녹음 시작" })).toBeDisabled();
    grantWith("USB Audio CODEC", "usb");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("radio", { name: "USB Audio CODEC" })).toBeInTheDocument();
  });

  it("says when there is no input to open", async () => {
    media.getUserMedia.mockRejectedValueOnce(new DOMException("Requested device not found", "NotFoundError"));
    render(<RecordingCheck />);
    fireEvent.click(screen.getByRole("button", { name: "마이크 권한 받기" }));

    expect(await screen.findByText("입력 장치가 없어요")).toBeInTheDocument();
    grantWith("USB Audio CODEC", "usb");
    fireEvent.click(screen.getByRole("button", { name: "다시 찾기" }));
    expect(await screen.findByRole("radio", { name: "USB Audio CODEC" })).toBeInTheDocument();
  });

  it("names MediaRecorder as missing and still shows the input levels", async () => {
    define(window, "MediaRecorder", undefined);
    await openUsbInput();

    expect(screen.getByText(/이 브라우저에서 안 되는 것: 녹음 \(MediaRecorder\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "녹음 시작" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10초 녹음" })).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "L 입력 레벨" })).toBeInTheDocument();
  });

  it("records in one-second pieces, joins them at stop, and copies a row for the issue table", async () => {
    await openUsbInput();
    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    expect(recorder().mimeType).toBe("audio/webm;codecs=opus");
    expect(recorder().timeslice).toBe(1000);

    act(() => [1, 2, 3].forEach(() => recorder().chunk(2000)));
    fireEvent.click(screen.getByRole("button", { name: "녹음 정지" }));

    const result = within((await screen.findByRole("heading", { name: "3. 결과" })).parentElement!);
    expect(result.getByRole("link", { name: "파일 내려받기" })).toHaveAttribute("download", expect.stringMatching(/^plypick-recording-\d{8}-\d{6}\.webm$/));
    expect(result.getByRole("link", { name: "파일 내려받기" })).toHaveAttribute("href", "blob:take");
    expect(document.querySelector("audio")).toHaveAttribute("src", "blob:take");
    expect(result.getByText("6 KB")).toBeInTheDocument();
    expect(result.getByText("audio/webm · .webm")).toBeInTheDocument();
    expect(result.getByText("4개")).toBeInTheDocument();
    const joined = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(joined.size).toBe(6100);

    fireEvent.click(result.getByRole("radio", { name: "믹서 소리" }));
    expect(await copiedRow()).toMatch(
      /^\| Chrome 138\.0 · Android 15\.0 · SM-S928N \| O \(USB Audio CODEC\) \| 2 · 좌우 다름 \(트랙 2\) \| audio\/webm;codecs=opus · 48000Hz \| 0:0\d · 이벤트 없음 \|$/,
    );
    const json = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(clipboard.writeText.mock.calls.at(-1)![0])![1]);
    expect(json.file).toMatchObject({ bytes: 6100, chunks: 4 });
    expect(json.device).toEqual({ index: 1, label: "USB Audio CODEC", listed: ["iPhone 마이크", "USB Audio CODEC"] });
    expect(json.settings).not.toHaveProperty("deviceId");
    expect(json.stoppedBy).toBe("user");
  });

  it("stops a 10-second take on its own", async () => {
    await openUsbInput();
    const timers = vi.spyOn(window, "setTimeout");
    fireEvent.click(screen.getByRole("button", { name: "10초 녹음" }));
    const tenSeconds = timers.mock.calls.find(([, ms]) => ms === 10_000)?.[0] as (() => void) | undefined;
    timers.mockRestore();
    expect(screen.getByRole("button", { name: "녹음 정지" })).toHaveAttribute("aria-pressed", "true");
    expect(recorder().state).toBe("recording");

    act(() => tenSeconds?.());
    expect(recorder().state).toBe("inactive");
    const result = within((await screen.findByRole("heading", { name: "3. 결과" })).parentElement!);
    expect(result.getByText("10초 끝")).toBeInTheDocument();
  });

  it("keeps what was recorded when the cable comes out mid-take", async () => {
    await openUsbInput();
    fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
    act(() => [1, 2].forEach(() => recorder().chunk(2000)));
    act(() => tracks[0].unplug());

    const result = within((await screen.findByRole("heading", { name: "3. 결과" })).parentElement!);
    expect(result.getByText(/녹음 중에 입력이 끊겼어요/)).toBeInTheDocument();
    expect(document.querySelector("audio")).toHaveAttribute("src", "blob:take");
    expect(screen.getByText(/입력이 끊겼어요. 케이블을 확인하고/)).toBeInTheDocument();
    expect(await copiedRow()).toMatch(/입력이 끊겨 멈춤 · 입력 끊김 1회 \|$/);
    expect((vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).size).toBe(4100);
  });

  it("releases the input and its audio graph on a device switch and on leaving the page", async () => {
    await openUsbInput();
    grantWith("iPhone 마이크", "mic");
    fireEvent.click(screen.getByRole("radio", { name: "iPhone 마이크" }));
    expect(await screen.findByRole("radio", { name: "iPhone 마이크", checked: true })).toBeInTheDocument();

    expect(media.getUserMedia).toHaveBeenLastCalledWith({ audio: expect.objectContaining({ deviceId: { exact: "mic" } }) });
    expect(tracks[0].stopped).toBe(true);
    expect(FakeAudioContext.instances[0].state).toBe("closed");
    expect(tracks[1].stopped).toBe(false);

    cleanup();
    expect(tracks[1].stopped).toBe(true);
    expect(FakeAudioContext.instances[1].state).toBe("closed");
  });
});
