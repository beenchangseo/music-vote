import { remainingVotes } from "@/lib/vote-domain";
import type { VoteAllowance } from "@/lib/types";

export default function VoteAllowanceStatus({ allowance }: { allowance: VoteAllowance | null }) {
  if (!allowance || allowance.mode !== "allocated") return null;
  const remaining = remainingVotes(allowance) ?? 0;
  const exhausted = remaining === 0;

  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 text-center text-sm ${
        exhausted
          ? "border-warning/30 bg-warning-soft text-text-muted"
          : "border-primary/25 bg-primary/10 text-text-muted"
      }`}
      role="status"
    >
      <p>
        <strong className="text-text">{allowance.voteLimit}표</strong> 중 {allowance.usedVotes}표 사용
        <span className="mx-1.5 text-text-subtle">·</span>
        <strong className={exhausted ? "text-warning" : "text-primary"}>{remaining}표 남음</strong>
      </p>
      {exhausted && (
        <p className="mt-1 text-caption leading-relaxed text-text-muted">
          <strong className="text-warning">투표권을 모두 사용했어요</strong>
          <span className="mx-1 text-text-subtle">·</span>
          기존 표를 취소하면 다시 투표할 수 있어요.
        </p>
      )}
    </div>
  );
}
