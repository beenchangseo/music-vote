// 랜딩의 셋리스트 예시. 투표의 결과물이 공연 순서와 총 시간이라는 걸 한 장으로 보여 준다.
// 숫자는 실제로 더한 값이다(곡 7개 + 인터벌 2:00 = 32:55).

type Row = { kind: "song"; no: string; title: string; artist: string; time: string } | { kind: "interval"; label: string; time: string };

const ROWS: Row[] = [
  { kind: "song", no: "01", title: "한 페이지가 될 수 있게", artist: "DAY6", time: "3:27" },
  { kind: "song", no: "02", title: "TOMBOY", artist: "혁오", time: "4:24" },
  { kind: "song", no: "03", title: "주저하는 연인들을 위해", artist: "잔나비", time: "4:57" },
  { kind: "interval", label: "멘트 · 악기 점검", time: "+2:00" },
  { kind: "song", no: "04", title: "스물다섯, 스물하나", artist: "자우림", time: "4:52" },
  { kind: "song", no: "05", title: "NO PAIN", artist: "실리카겔", time: "4:04" },
  { kind: "song", no: "06", title: "Everything", artist: "검정치마", time: "4:23" },
  { kind: "song", no: "07", title: "Don't Look Back in Anger", artist: "Oasis", time: "4:48" },
];

export default function LandingSetlistPoster() {
  return (
    <figure className="relative m-0 overflow-hidden rounded-card border border-border bg-surface">
      {/* Smaller and higher on phones so the circles stay clear of the show line. */}
      <span aria-hidden className="absolute -right-14 -top-16 size-40 rounded-pill bg-primary opacity-50 lg:-right-10 lg:-top-12 lg:size-48" />
      <span aria-hidden className="absolute -top-12 right-6 size-28 rounded-pill bg-primary-hover opacity-85 lg:-top-2.5 lg:right-12 lg:size-36" />
      <div className="relative px-5 pt-5">
        <p className="text-caption font-bold tracking-widest text-text">SETLIST</p>
        <p className="mt-1.5 text-h1 font-black text-text">주말합주단</p>
        <p className="mt-1 text-sm text-text">11월 23일(일) 홍대 라이브클럽</p>
      </div>
      <ol className="relative mt-5 px-5">
        {ROWS.map((row) =>
          row.kind === "song" ? (
            <li key={row.no} className="flex items-baseline gap-3 border-t border-surface-hover py-2.5">
              <span className="w-6 text-sm font-bold tabular-nums text-text-muted">{row.no}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-text">
                {row.title} <span className="font-normal text-text-muted">· {row.artist}</span>
              </span>
              <span className="text-sm tabular-nums text-text-muted">{row.time}</span>
            </li>
          ) : (
            <li key={row.label} className="flex items-center gap-3 border-t border-surface-hover py-2">
              <span className="w-6" />
              <span className="flex-1 text-caption text-text-subtle">{row.label}</span>
              <span className="text-caption tabular-nums text-text-subtle">{row.time}</span>
            </li>
          ),
        )}
      </ol>
      <figcaption className="relative mt-1 flex items-baseline justify-between bg-surface-hover px-5 pb-4 pt-3.5">
        <span className="text-sm text-text-muted">7곡 · 쉬는 시간 포함</span>
        <span className="text-h3 font-extrabold tabular-nums text-text">32:55</span>
      </figcaption>
    </figure>
  );
}
