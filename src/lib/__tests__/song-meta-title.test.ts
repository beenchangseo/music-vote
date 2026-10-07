import { describe, expect, it } from "vitest";
import { displayArtist, displayTitle } from "../song-meta";

// 후보곡 카드 한 줄 구조(디자인 C9)는 제목 칸이 좁아서 유튜브 원제목을 그대로 두면 넘친다.
describe("displayTitle", () => {
  it("앞의 아티스트와 영상 종류 괄호를 뗀다", () => {
    expect(displayTitle("DAY6(데이식스)- 예뻤어 [가사/Lyrics]")).toBe("예뻤어");
    expect(displayTitle("잔나비 - 주저하는 연인들을 위해 (Official Audio)")).toBe("주저하는 연인들을 위해");
    expect(displayTitle("Bill Withers - Just The Two Of Us (official video)")).toBe("Just The Two Of Us");
    expect(displayTitle("백예린 (Yerin Baek) - La La La Love Song (Video)")).toBe("La La La Love Song");
  });

  it("앞의 대괄호 태그와 | 뒤의 다른 표기를 뗀다", () => {
    expect(displayTitle("[MV] 체리필터 - 낭만고양이 | Cherryfilter - Romantic Cat")).toBe("낭만고양이");
    expect(displayTitle("[11회 풀버전] 터치드 - 얼음요새")).toBe("얼음요새");
  });

  it("곡 이름에 속한 괄호와 이름 안의 대시는 남긴다", () => {
    expect(displayTitle("Event Horizon (사건의 지평선)")).toBe("Event Horizon (사건의 지평선)");
    expect(displayTitle("Queen - Bohemian Rhapsody (Live Aid 1985)")).toBe("Bohemian Rhapsody (Live Aid 1985)");
    expect(displayTitle("Anti-Hero")).toBe("Anti-Hero");
    expect(displayTitle("MVP (MVP)")).toBe("MVP (MVP)");
  });

  it("다 떼고 남는 게 없으면 원래 제목을 쓴다", () => {
    expect(displayTitle("[MV]")).toBe("[MV]");
  });
});

describe("displayArtist with a dash that has no space before it", () => {
  it("업로더 채널 대신 제목의 아티스트를 쓴다", () => {
    expect(displayArtist("웅키", "DAY6(데이식스)- 예뻤어 [가사/Lyrics]")).toBe("DAY6(데이식스)");
  });
});
