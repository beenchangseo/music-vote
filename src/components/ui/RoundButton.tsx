import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { variantClasses } from "./Button";

const BARE_SKIN = {
  plain: "text-text hover:bg-surface-hover",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
};

const DISC_SKIN = {
  tonal: variantClasses.tonal,
  inverse: "bg-text text-bg hover:bg-text/90",
  primary: variantClasses.primary,
  danger: variantClasses.danger,
  kakao: variantClasses.kakao,
};

const TOGGLE_SKIN = { off: BARE_SKIN.ghost, on: "text-primary-fg hover:bg-surface-hover" };

/**
 * 투표 화살표. 투표 알약(surface-hover) 위에 놓인다. 고른 쪽(chosen)이면 찬성·반대 색 글리프에 같은 색의 옅은 원판
 * (success-tint·danger-tint)을 깐다. 글리프와 원판은 tokens.ts 가 4.5:1 이상으로 묶어 둔다.
 * 누르는 일이 켜고 끄기가 아니라서(할당 모드는 한 표를 더 쌓는다) aria-pressed 를 달지 않는다. 할 일은 라벨이 말한다.
 */
const VOTE_SKIN = {
  upvote: { idle: "text-text-muted hover:bg-surface-elevated hover:text-success", chosen: "bg-success-tint text-success" },
  downvote: { idle: "text-text-muted hover:bg-surface-elevated hover:text-danger-fg", chosen: "bg-danger-tint text-danger-fg" },
};

export type RoundBareTone = keyof typeof BARE_SKIN;
export type RoundDiscTone = keyof typeof DISC_SKIN;
export type RoundSize = "md" | "lg" | "hero";
export type RoundVoteTone = keyof typeof VOTE_SKIN;
export const ROUND_BARE_TONES = Object.keys(BARE_SKIN) as RoundBareTone[];
export const ROUND_DISC_TONES = Object.keys(DISC_SKIN) as RoundDiscTone[];
export const ROUND_VOTE_TONES = Object.keys(VOTE_SKIN) as RoundVoteTone[];

const DIAMETER: Record<RoundSize, string> = { md: "size-control-md", lg: "size-control-lg", hero: "size-control-hero" };

// `[&_svg]` (0,1,1) outranks the size class an icon component puts on its own svg (0,1,0), so the button's size wins.
const BARE = {
  md: { glyph: "[&_svg]:size-6 text-h4", edgeStart: "-ml-2.5" },
  lg: { glyph: "[&_svg]:size-7 text-h3", edgeStart: "-ml-3" },
} as const;
const DISC_GLYPH: Record<RoundSize, string> = {
  md: "[&_svg]:size-5 text-h4",
  lg: "[&_svg]:size-6 text-h3",
  hero: "[&_svg]:size-7 text-h3",
};

type BareLook = { tone: RoundBareTone; size: "md" | "lg"; pressed?: never; chosen?: never; edge?: "start" };
type ToggleLook = { tone?: never; size: "md" | "lg"; pressed: boolean; chosen?: never; edge?: never };
type VoteLook = { tone: RoundVoteTone; size: "md" | "lg"; chosen: boolean; pressed?: never; edge?: never };
type DiscLook = { tone: RoundDiscTone; size: RoundSize; pressed?: never; chosen?: never; edge?: never };
export type RoundLook = BareLook | ToggleLook | VoteLook | DiscLook;

type Own = { "aria-label": string; className?: string; children: ReactNode };
type Closed = keyof Own | "aria-pressed" | "style";

export type RoundButtonProps = Own & RoundLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, Closed>;
export type RoundLinkProps = Own & (BareLook | DiscLook) & Omit<ComponentProps<typeof Link>, Closed>;

const BASE =
  "relative inline-flex shrink-0 items-center justify-center rounded-pill font-bold leading-none tabular-nums transition-all " +
  "active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const isBare = (look: RoundLook): look is BareLook => look.tone !== undefined && look.tone in BARE_SKIN;

function lookClassName(look: RoundLook): string {
  if (look.pressed !== undefined) {
    return `${DIAMETER[look.size]} ${BARE[look.size].glyph} ${look.pressed ? TOGGLE_SKIN.on : TOGGLE_SKIN.off}`;
  }
  if (look.chosen !== undefined) {
    const skin = VOTE_SKIN[look.tone];
    return `${DIAMETER[look.size]} ${BARE[look.size].glyph} ${look.chosen ? skin.chosen : skin.idle}`;
  }
  if (isBare(look)) {
    return `${DIAMETER[look.size]} ${BARE[look.size].glyph} ${BARE_SKIN[look.tone]} ${look.edge ? BARE[look.size].edgeStart : ""}`;
  }
  return `${DIAMETER[look.size]} ${DISC_GLYPH[look.size]} ${DISC_SKIN[look.tone]}`;
}

const RoundButton = forwardRef<HTMLButtonElement, RoundButtonProps>(function RoundButton(
  { tone, size, pressed, chosen, edge, className = "", type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={`${BASE} ${lookClassName({ tone, size, pressed, chosen, edge } as RoundLook)} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default RoundButton;

export function RoundLink({ tone, size, edge, className = "", children, ...rest }: RoundLinkProps) {
  return (
    <Link className={`${BASE} ${lookClassName({ tone, size, edge } as RoundLook)} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

// Five discs (at most 64 + 4 × 52 = 272) with 12px gaps need 320px, which is @xs. Narrower rows drop the gaps to 4.
export function RoundRow({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`@container w-full ${className}`}>
      <div className="flex items-center justify-center gap-1 @xs:gap-3">{children}</div>
    </div>
  );
}
