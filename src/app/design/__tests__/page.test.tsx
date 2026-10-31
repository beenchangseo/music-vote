// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import DialogProvider from "@/components/ui/DialogProvider";
import DesignPage, { metadata } from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("/design", () => {
  it("answers 404 on the production deploy", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => DesignPage()).toThrow("NEXT_NOT_FOUND");
  });

  it.each([["preview"], [""]])("renders on VERCEL_ENV=%j (preview deploy, next dev)", (env) => {
    vi.stubEnv("VERCEL_ENV", env);
    render(<DialogProvider>{DesignPage()}</DialogProvider>);
    expect(screen.getByRole("heading", { level: 1, name: "디자인 시스템" })).toBeInTheDocument();
  });

  it("keeps search engines out", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("shows each pairing with its computed contrast, and the forbidden one struck out", () => {
    render(<DialogProvider>{DesignPage()}</DialogProvider>);
    // primary-fg on surface, white on primary, text-subtle on surface-elevated
    expect(screen.getByTitle("primary-fg on surface")).toHaveTextContent("6.52");
    expect(screen.getByTitle("on-primary on primary")).toHaveTextContent("5.70");
    expect(screen.getByTitle("text-subtle on surface-elevated")).toHaveTextContent("4.08 금지");
  });

  it("shows every Button variant in default, hover, disabled and loading", () => {
    render(<DialogProvider>{DesignPage()}</DialogProvider>);
    const saves = screen.getAllByRole("button", { name: "저장" });
    expect(saves).toHaveLength(5 * 4);
    expect(saves.filter((b) => b.getAttribute("aria-busy") === "true")).toHaveLength(5);
  });
});
