import { describe, expect, it } from "vitest";
import { displayArtist } from "../song-meta";

// 프로덕션 합주방에서 실제로 나온 값들이다.
describe("displayArtist", () => {
  it("자동 생성 채널의 - Topic 을 떼어낸다", () => {
    expect(displayArtist("YOUNHA - Topic", "Event Horizon (사건의 지평선)")).toBe("YOUNHA");
    expect(displayArtist("HANRORO - Topic", "해초")).toBe("HANRORO");
    expect(displayArtist("Nemesis - Topic", "Cotton Candy")).toBe("Nemesis");
  });

  it("VEVO 접미사를 떼어낸다", () => {
    expect(displayArtist("EarthWindandFireVEVO", "September")).toBe("EarthWindandFire");
  });

  it("핸들처럼 생긴 채널은 버리고 제목에서 아티스트를 찾는다", () => {
    expect(
      displayArtist("kwon.orca.archive", "백예린 (Yerin Baek) - La La La Love Song (Video)"),
    ).toBe("백예린 (Yerin Baek)");
  });

  it("채널 설명에 가까운 긴 문장은 버린다", () => {
    expect(
      displayArtist(
        "Pop music crooners of the 20th century",
        "Bill Withers - Just The Two Of Us (official video)",
      ),
    ).toBe("Bill Withers");
  });

  it("제목 앞의 대괄호 태그는 아티스트로 보지 않는다", () => {
    expect(displayArtist("PLAY THAT K-POP", "[PTK] H1-KEY (하이키) - 건물 사이에 피어난 장미"),
    ).toBe("H1-KEY (하이키)");
  });

  it("재업로드 채널보다 제목에 적힌 아티스트를 쓴다", () => {
    // Mnet TV 는 업로더이고 터치드가 밴드다.
    expect(displayArtist("Mnet TV", "[11회 풀버전] 터치드 - 얼음요새")).toBe("터치드");
  });

  it("제목에 아티스트가 없으면 쓸 만한 채널명을 쓴다", () => {
    expect(displayArtist("Mnet TV", "얼음요새 라이브")).toBe("Mnet TV");
  });

  it("채널명이 제목에 이미 들어 있으면 제목 쪽을 쓴다", () => {
    expect(displayArtist("백예린", "백예린 - Antifreeze")).toBe("백예린");
  });

  it("쓸 것이 없으면 null 을 돌려준다", () => {
    expect(displayArtist(null, "Peachy")).toBeNull();
    expect(displayArtist("", "Daydream")).toBeNull();
    expect(displayArtist("some.random.handle", "abcdefu")).toBeNull();
  });

  it("빈 줄이 틀린 줄보다 낫다 — 애매하면 숨긴다", () => {
    expect(
      displayArtist("Official Channel For Everything About Music", "Some Song"),
    ).toBeNull();
  });
});
