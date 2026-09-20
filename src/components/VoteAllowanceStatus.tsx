import { remainingVotes } from "@/lib/vote-domain";
import type { VoteAllowance } from "@/lib/types";

/**
 * 남은 투표권. 화면 상단 툴바의 캡션 줄 안에 인라인으로 들어간다.
 * 종전에는 별도 박스였는데, 세 화면 상단을 같은 툴바로 맞추면서 그 안으로 넣었다.
 */
export default function VoteAllowanceStatus({ allowance }: { allowance: VoteAllowance | null }) {
  if (!allowance || allowance.mode !== "allocated") return null;
  const remaining = remainingVotes(allowance) ?? 0;

  if (remaining === 0) {
    return (
      <span role="status" className="flex flex-wrap items-center gap-x-1.5">
        <strong className="text-warning">투표권을 모두 사용했어요</strong>
        <span aria-hidden className="text-text-subtle">·</span>
        <span>기존 표를 취소하면 다시 투표할 수 있어요.</span>
      </span>
    );
  }

  return (
    <span role="status">
      <strong className="text-primary">{remaining}표 남음</strong>
      <span className="ml-1.5 text-text-subtle">
        {allowance.voteLimit}표 중 {allowance.usedVotes}표 사용
      </span>
    </span>
  );
}
