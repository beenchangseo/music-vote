import { describe, expect, it } from "vitest";
import { hostDenial } from "../playlist-host";

describe("hostDenial", () => {
  it.each([
    ["the creator, logged in", { creator_user_id: "host" }, "host", null],
    ["another logged-in member", { creator_user_id: "host" }, "member", "not_host"],
    ["a logged-out visitor", { creator_user_id: "host" }, null, "not_logged_in"],
    ["anyone in an archived playlist", { creator_user_id: null }, "host", "archived"],
  ] as const)("answers %s with %s", (_case, playlist, userId, denial) => {
    expect(hostDenial(playlist, userId)).toBe(denial);
  });
});
