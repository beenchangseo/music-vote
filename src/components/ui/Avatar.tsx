import { avatarInitial } from "@/lib/band-art";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "size-8 text-sm",
  md: "size-11 text-sm",
  lg: "size-16 text-h3",
};

interface AvatarProps {
  name: string;
  /** 카카오 프로필 사진. 없으면 이름 첫 글자. */
  src?: string | null;
  size?: Size;
  className?: string;
}

/** 이름은 옆 글자나 감싼 버튼이 읽어 주므로 그림 자체는 숨긴다. 바탕이 불투명해서 겹쳐 놓아도 비치지 않는다. */
export default function Avatar({ name, src, size = "sm", className = "" }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-primary-tint font-semibold text-on-primary-tint ${sizeClasses[size]} ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Kakao CDN avatars are tiny and not in next.config images.
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        avatarInitial(name)
      )}
    </span>
  );
}

/** 겹친 아바타 (Spotify Jam). max 명까지 그리고 나머지는 +N. */
export function AvatarStack({ names, max = 3, className = "" }: { names: readonly string[]; max?: number; className?: string }) {
  const rest = names.length - max;
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="flex -space-x-2">
        {names.slice(0, max).map((name, i) => (
          <Avatar key={`${name}-${i}`} name={name} className="ring-2 ring-bg" />
        ))}
      </span>
      {rest > 0 && <span className="ml-1.5 text-sm text-text-muted tabular-nums">+{rest}</span>}
    </span>
  );
}
