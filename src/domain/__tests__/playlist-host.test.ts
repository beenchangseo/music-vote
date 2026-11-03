import { describe, expect, it } from "vitest";
import { hostDenial, isHostOrAdder } from "../playlist-host";

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

describe("isHostOrAdder", () => {
  it.each([
    ["the host, on someone else's song", { creator_user_id: "host" }, "adder", "host", true],
    ["the member who added it", { creator_user_id: "host" }, "adder", "adder", true],
    ["another member", { creator_user_id: "host" }, "adder", "member", false],
    ["a logged-out visitor, on a song with no adder", { creator_user_id: "host" }, null, null, false],
    ["the adder in an archived playlist", { creator_user_id: null }, "adder", "adder", false],
  ] as const)("answers %s with %s", (_case, playlist, addedBy, userId, allowed) => {
    expect(isHostOrAdder(playlist, addedBy, userId)).toBe(allowed);
  });
});
