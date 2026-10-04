/**
 * 밴드 표시용 기타 선 아이콘 (디자인 리뷰 15A). 밴드 화면·경로 줄·홈 "내 밴드"·초대 화면이 같이 쓴다.
 * 🎸 이모지는 카톡 band 카드 제목에만 쓴다.
 */
export default function GuitarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M13.5 10.5 20 4" />
      <path d="m18.5 2.5 3 3" />
      <path d="M11.3 9.2c-1.4-1.1-3.4-1-4.6.3l-.4.4c-.6.6-1.5.9-2.3.9-1.4 0-2.5 1.6-1.6 3.6.6 1.4 1.7 2.9 3 4.2s2.8 2.4 4.2 3c2 .9 3.6-.2 3.6-1.6 0-.8.3-1.7.9-2.3l.4-.4c1.3-1.2 1.4-3.2.3-4.6" />
      <circle cx="9.5" cy="14.5" r="1.5" />
    </svg>
  );
}
