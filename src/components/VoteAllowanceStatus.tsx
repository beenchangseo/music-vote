import { remainingVotes } from "@/lib/vote-domain";
import type { VoteAllowance } from "@/lib/types";

export default function VoteAllowanceStatus({ allowance }: { allowance: VoteAllowance | null }) {
  if (!allowance || allowance.mode !== "allocated") return null;
  const remaining = remainingVotes(allowance) ?? 0;
  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-center text-sm text-text-muted">
      <strong className="text-text">{allowance.voteLimit}표</strong> 중 {allowance.usedVotes}표 사용
      <span className="mx-1.5 text-text-subtle">·</span>
      <strong className="text-primary">{remaining}표 남음</strong>
    </div>
  );
}
