// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../../../../next.config";

const state = vi.hoisted(() => ({
  user: null as { id: string; nickname: string; avatarUrl: string | null } | null,
  recorderProps: [] as unknown[],
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/recording/RecordingCheckLoader", () => ({
  default: (props: unknown) => {
    state.recorderProps.push(props);
    return null;
  },
}));

import RecordingCheckPage, { generateMetadata } from "../page";

const OPERATOR = "0b6f1f0e-8c7e-4c1a-9d1f-3f2b1a7c9e10";
const MEMBER = "11111111-1111-4111-8111-111111111111";

function logIn(id: string) {
  state.user = { id, nickname: "창서", avatarUrl: null };
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  state.user = null;
  state.recorderProps = [];
});

describe("/lab/recording", () => {
  it("answers 404 to a visitor who is not logged in", async () => {
    vi.stubEnv("LAB_USER_IDS", OPERATOR);
    await expect(RecordingCheckPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 to a logged-in user who is not on the list", async () => {
    vi.stubEnv("LAB_USER_IDS", OPERATOR);
    logIn(MEMBER);
    await expect(RecordingCheckPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([["unset", undefined], ["empty", ""]])("answers 404 to everyone while LAB_USER_IDS is %s", async (_, value) => {
    vi.stubEnv("LAB_USER_IDS", value);
    logIn(OPERATOR);
    await expect(RecordingCheckPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("opens for a listed user and hands the screen nothing about the account", async () => {
    vi.stubEnv("LAB_USER_IDS", `${MEMBER}, ${OPERATOR}`);
    logIn(OPERATOR);
    render((await RecordingCheckPage()) as ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "녹음 점검" })).toBeInTheDocument();
    expect(state.recorderProps).toEqual([{}]);
    expect(document.body.innerHTML).not.toContain(OPERATOR);
  });

  it("titles the page for a listed user and keeps search engines out", async () => {
    vi.stubEnv("LAB_USER_IDS", OPERATOR);
    logIn(OPERATOR);
    expect(await generateMetadata()).toEqual({ title: "녹음 점검 · Plypick", robots: { index: false, follow: false } });
  });

  it.each([
    ["logged out", null],
    ["not on the list", MEMBER],
  ])("gives a visitor who is %s no metadata that names the page", async (_, id) => {
    vi.stubEnv("LAB_USER_IDS", OPERATOR);
    if (id) logIn(id);
    expect(JSON.stringify(await generateMetadata())).not.toContain("녹음");
  });
});

describe("Permissions-Policy", () => {
  /** The value a path gets: the last matching entry wins (next.config headers docs). */
  async function policyFor(path: string) {
    const entries = await nextConfig.headers!();
    const matching = entries.filter(({ source }) => new RegExp(`^${source.replace("(.*)", ".*")}$`).test(path));
    return matching.flatMap((entry) => entry.headers).findLast((header) => header.key === "Permissions-Policy")?.value;
  }

  it("lets the recording check ask for the microphone", async () => {
    expect(await policyFor("/lab/recording")).toBe("camera=(), microphone=(self), geolocation=()");
  });

  it.each([["/"], ["/playlist/qDPJnh1d"], ["/lab/recording/x"]])("keeps the microphone off on %s", async (path) => {
    expect(await policyFor(path)).toBe("camera=(), microphone=(), geolocation=()");
  });
});
