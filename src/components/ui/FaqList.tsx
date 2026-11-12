import type { FaqEntry } from "@/lib/seo";
import { ChevronIcon } from "./icons";

export default function FaqList({ items }: { items: readonly FaqEntry[] }) {
  return (
    <div className="border-t border-surface-hover">
      {items.map((item, i) => (
        // The first answer starts open; the rest are one tap away and still in the HTML for search engines.
        <details key={item.question} open={i === 0} className="group border-b border-surface-hover">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-body font-semibold text-text [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronIcon direction="down" className="shrink-0 text-text-muted transition-transform group-open:rotate-180 size-5" />
          </summary>
          <p className="break-keep pb-4.5 text-body text-text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
