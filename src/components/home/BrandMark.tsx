/** 랜딩 머리의 Plypick 로고. 아이콘이 아닌 브랜드 마크라 ui/icons 밖에서 그린다. */
export default function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-control bg-gradient-to-br from-primary to-indigo-600 shadow-lg shadow-primary/30">
        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
          />
        </svg>
      </div>
      <span className="text-body font-bold text-text">Plypick</span>
    </div>
  );
}
