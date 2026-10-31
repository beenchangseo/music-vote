import type { FaqEntry } from "@/lib/seo";

export default function FaqList({ items }: { items: readonly FaqEntry[] }) {
  return (
    <div className="border-t border-surface-hover">
      {items.map((item, i) => (
        // The first answer starts open; the rest are one tap away and still in the HTML for search engines.
        <details key={item.question} open={i === 0} className="group border-b border-surface-hover">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-body font-semibold text-text [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <svg
              className="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <p className="break-keep pb-4.5 text-body text-text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
