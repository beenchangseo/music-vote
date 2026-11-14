// 랜딩의 예시 플레이리스트 「10월 정기 합주」의 후보곡. 직접 눌러 보는 투표(클라이언트)와 카톡 카드 그림(서버)이
// 같이 읽는다. "use client" 모듈의 값은 서버 컴포넌트가 읽을 수 없어서 따로 둔다.

export interface DemoSong {
  id: string;
  title: string;
  artist: string;
  /** Score from the four members who already voted. */
  votes: number;
  cover: "violet" | "slate" | "night";
}

/** 목록 순서가 올라온 순서다. */
export const DEMO_SONGS: DemoSong[] = [
  { id: "tomboy", title: "TOMBOY", artist: "혁오", votes: 2, cover: "slate" },
  { id: "page", title: "한 페이지가 될 수 있게", artist: "DAY6", votes: 2, cover: "violet" },
  { id: "lovers", title: "주저하는 연인들을 위해", artist: "잔나비", votes: 1, cover: "violet" },
  { id: "twentyfive", title: "스물다섯, 스물하나", artist: "자우림", votes: 1, cover: "night" },
  { id: "anger", title: "Don't Look Back in Anger", artist: "Oasis", votes: 0, cover: "slate" },
];
