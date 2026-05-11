// 곡 카드에 외부 악보·코드 검색 사이트 4개 단축 링크.
// 한국 가요/팝/락 커버 시나리오에 맞춰 우선순위.

interface SheetMusicLinksProps {
  title: string;
  artist?: string | null;
}

interface Site {
  key: string;
  label: string;
  /** 제목 + 아티스트 → 검색 URL */
  url: (query: string) => string;
  /** 어떤 시장에 강한지 (툴팁) */
  note: string;
}

const SITES: Site[] = [
  {
    key: "ug",
    label: "Ultimate Guitar",
    note: "팝·락 기타/베이스 탭",
    url: (q) =>
      `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`,
  },
  {
    key: "chordify",
    label: "Chordify",
    note: "YouTube 곡 자동 코드 분석",
    url: (q) => `https://chordify.net/search/${encodeURIComponent(q)}`,
  },
  {
    key: "musicnote",
    label: "뮤직노트",
    note: "한국 가요 악보",
    url: (q) => `https://www.musicnote.co.kr/search?q=${encodeURIComponent(q)}`,
  },
  {
    key: "akbobada",
    label: "악보바다",
    note: "한국 가요 보컬/피아노",
    url: (q) =>
      `https://www.akbobada.com/home/search?keyword=${encodeURIComponent(q)}`,
  },
];

function buildQuery(title: string, artist?: string | null): string {
  if (artist && artist.trim()) return `${artist.trim()} ${title.trim()}`;
  return title.trim();
}

export default function SheetMusicLinks({ title, artist }: SheetMusicLinksProps) {
  const query = buildQuery(title, artist);

  return (
    <div>
      <div className="text-caption font-semibold text-text-muted mb-1.5">
        악보·코드 검색
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SITES.map((s) => (
          <a
            key={s.key}
            href={s.url(query)}
            target="_blank"
            rel="noopener noreferrer"
            title={s.note}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-surface-hover text-caption font-semibold text-text-muted hover:text-text hover:bg-gray-700 transition-colors"
          >
            <ExternalIcon />
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
