// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LANDING_INVITE, LandingShareChat } from "../LandingShareCard";
import PlaylistHeader from "@/components/playlist/PlaylistHeader";

vi.mock("@/components/ui/DialogProvider", () => ({ useDialog: () => ({ showAlert: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

type SentCard = { content: { title: string; description: string }; buttons: { title: string }[] };

/** What the playlist screen's share glyph sends to Kakao for the landing's example playlist. */
function sentInvite(): SentCard {
  const sendDefault = vi.fn();
  window.Kakao = { isInitialized: () => true, Share: { sendDefault } };
  render(
    <PlaylistHeader
      title={LANDING_INVITE.title}
      inviteSongs={LANDING_INVITE.songs}
      participantCount={LANDING_INVITE.participants}
      shareCode="landing"
      notice={null}
      menu={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  cleanup();
  return sendDefault.mock.calls[0][0] as SentCard;
}

afterEach(() => {
  cleanup();
  delete window.Kakao;
});

describe("LandingShareChat", () => {
  it("draws the title, description and button the playlist share sends for the same playlist", () => {
    const sent = sentInvite();
    render(<LandingShareChat />);
    expect(screen.getByText(sent.content.title)).toBeInTheDocument();
    expect(screen.getByText(sent.content.description)).toBeInTheDocument();
    expect(screen.getByText(sent.buttons[0].title)).toBeInTheDocument();
  });
});
