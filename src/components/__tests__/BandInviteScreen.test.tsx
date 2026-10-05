// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BandInviteScreen from "../BandInviteScreen";

const joinTeam = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const track = vi.fn();

vi.mock("@/actions/team", () => ({ joinTeam: (...args: unknown[]) => joinTeam(...args) }));
vi.mock("@/lib/analytics", () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));
// The real LoginButton starts a Supabase OAuth redirect; only its click matters here.
vi.mock("../LoginButton", () => ({
  default: ({ label, next }: { label: string; next: string }) => (
    <button type="button" data-next={next}>
      {label}
    </button>
  ),
}));

const CODE = "aB3_x-9Zq0";
const TEAM = "11111111-1111-4111-8111-111111111111";

function renderInvite(props: Partial<Parameters<typeof BandInviteScreen>[0]> = {}) {
  return render(
    <BandInviteScreen
      code={CODE}
      name="일코해제"
      loggedIn
      memberCount={5}
      previewNames={["보컬", "기타", "드럼"]}
      nextShowAt={null}
      joinRequested={false}
      {...props}
    />,
  );
}

function joinCookie(): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith("plypick_join="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookie(value: string) {
  document.cookie = `plypick_join=${encodeURIComponent(value)}; Path=/join`;
}

beforeEach(() => {
  // The cookie is scoped to /join, so the document must be on that path to see it.
  window.history.replaceState({}, "", `/join/${CODE}?join=1`);
  document.cookie = "plypick_join=; Max-Age=0; Path=/join";
  joinTeam.mockReset().mockResolvedValue({ success: true, teamId: TEAM, alreadyMember: false });
  replace.mockReset();
  refresh.mockReset();
  track.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BandInviteScreen auto-join after login (R5)", () => {
  it("does not join when ?join=1 arrives without the mark, and strips the query", async () => {
    renderInvite({ joinRequested: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/join/${CODE}`));
    expect(joinTeam).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "밴드 들어가기" })).toBeInTheDocument();
  });

  it("joins exactly once when the mark matches, then clears the mark and lands on the band home", async () => {
    setCookie(CODE);
    const { rerender } = renderInvite({ joinRequested: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/band/${TEAM}?joined=1`));
    // A re-render (the query strip re-renders the page) must not join again.
    rerender(
      <BandInviteScreen
        code={CODE}
        name="일코해제"
        loggedIn
        memberCount={5}
        previewNames={["보컬", "기타", "드럼"]}
        nextShowAt={null}
        joinRequested
      />,
    );
    expect(joinTeam).toHaveBeenCalledTimes(1);
    expect(joinTeam).toHaveBeenCalledWith(CODE);
    expect(joinCookie()).toBeNull();
    expect(track).toHaveBeenCalledWith("team_joined", { auto: true });
  });

  it("does not join with a mark for a different invite code", async () => {
    setCookie("ZZZZZZZZZZ");
    renderInvite({ joinRequested: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/join/${CODE}`));
    expect(joinTeam).not.toHaveBeenCalled();
  });

  it("shows the invite screen when the cookie jar cannot be read", async () => {
    vi.spyOn(document, "cookie", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderInvite({ joinRequested: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/join/${CODE}`));
    expect(joinTeam).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "일코해제" })).toBeInTheDocument();
  });

  it("never joins on its own without ?join=1", () => {
    setCookie(CODE);
    renderInvite({ joinRequested: false });
    expect(joinTeam).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a failed auto-join back to the plain invite address with the reason", async () => {
    setCookie(CODE);
    joinTeam.mockResolvedValue({ success: false, reason: "invite_not_found" });
    renderInvite({ joinRequested: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/join/${CODE}`));
    expect(await screen.findByRole("alert")).toHaveTextContent("이 초대 링크는 더 이상 쓸 수 없어요");
  });
});

describe("BandInviteScreen", () => {
  it("sets the join mark when the logged-out button is pressed and returns with ?join=1", () => {
    renderInvite({ loggedIn: false });
    const button = screen.getByRole("button", { name: "카카오로 로그인하고 들어가기" });
    expect(button).toHaveAttribute("data-next", `/join/${CODE}?join=1`);
    fireEvent.click(button);
    expect(joinCookie()).toBe(CODE);
  });

  it("shows the member count and only the first three names", () => {
    renderInvite();
    expect(screen.getByText("멤버 5명")).toBeInTheDocument();
    expect(screen.getByText("보컬, 기타, 드럼 외 2명")).toBeInTheDocument();
  });

  it("joins on tap and shows the reason under the button when it fails", async () => {
    joinTeam.mockResolvedValue({ success: false, reason: "write_failed" });
    renderInvite();
    fireEvent.click(screen.getByRole("button", { name: "밴드 들어가기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요");
    expect(track).not.toHaveBeenCalled();
  });

  it("goes to the band home with the joined banner after a tap", async () => {
    renderInvite();
    fireEvent.click(screen.getByRole("button", { name: "밴드 들어가기" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/band/${TEAM}?joined=1`));
    expect(track).toHaveBeenCalledWith("team_joined", { auto: false });
  });
});
