import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Button, { BUTTON_VARIANTS, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import GuitarIcon from "@/components/ui/GuitarIcon";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import ScreenToolbar from "@/components/ui/ScreenToolbar";
import { COLOR_GROUPS, COLORS, HEIGHTS, MOTION, RADII, SHADOWS, TYPE, contrastRatio, type ColorToken, type Pairing } from "@/components/ui/tokens";
import { DialogDemo, HoverSample, ModalDemo, MotionDemo } from "./demos";

export const metadata: Metadata = {
  title: "디자인 시스템 · Plypick",
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  // A working reference for next dev and Vercel preview deploys, not a page for users.
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8">
      <h1 className="text-h1 font-bold text-text">디자인 시스템</h1>
      <p className="mt-2 text-sm text-text-muted">
        값의 원본은 <code>globals.css</code>, 쓰임과 대비는 <code>components/ui/tokens.ts</code> 에 있어요. 개발 서버와
        미리보기 배포에서만 보여요.
      </p>

      <Section title="색" note="숫자는 WCAG 대비. 글자는 4.5, 테두리·링·아이콘만 있는 곳은 3 이상이어야 해요. 줄 그은 칸은 쓰지 않는 조합이에요.">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="mt-6">
            <h3 className="text-h4 font-semibold text-text">{group.title}</h3>
            <p className="mt-1 text-sm text-text-muted">{group.note}</p>
            <ul className="mt-2">
              {group.tokens.map((t) => (
                <ColorRow key={t.name} token={t} />
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="글자 크기" note="한국어는 줄간격 1.5 이상. 토큰 밖 크기(text-lg, text-[11px])는 쓰지 않아요.">
        <ul className="space-y-4">
          {TYPE.map((t) => (
            <li key={t.name}>
              <p className={`${t.utility} font-semibold text-text`}>같은 얘기 또 하지 마세요</p>
              <TokenLabel token={t} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="모서리">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {RADII.map((t) => (
            <li key={t.name}>
              <span className={`block h-16 w-full border border-border-strong bg-surface-hover ${t.utility}`} />
              <TokenLabel token={t} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="높이" note="control-sm 은 보이는 높이만 36px 이고 누르는 영역은 44px 이에요.">
        <ul className="space-y-3">
          {HEIGHTS.map((t) => (
            <li key={t.name}>
              <span className={`flex w-full items-center rounded-control bg-surface-hover px-3 text-sm text-text ${t.utility}`}>{t.name}</span>
              <TokenLabel token={t} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="그림자" note="다크에서 층은 표면 색으로 만들어요. 그림자는 떠 있는 것에만.">
        {SHADOWS.map((t) => (
          <div key={t.name}>
            <div className={`rounded-card bg-surface-elevated p-4 text-sm text-text ${t.utility}`}>셋리스트에 넣었어요</div>
            <TokenLabel token={t} />
          </div>
        ))}
      </Section>

      <Section title="모션" note="이징은 하나. transition 의 기본값이 200ms 와 이 이징이에요. vote-pop·score-in 은 따로 둬요.">
        <MotionDemo durations={MOTION.filter((t) => t.utility.startsWith("duration-"))} />
        <ul className="mt-4">
          {MOTION.map((t) => (
            <li key={t.name}>
              <TokenLabel token={t} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Button" note="채운 보라 버튼은 화면에 하나. 나란한 보조 동작은 tonal, 덜 중요한 동작은 ghost. 같은 일을 하는 버튼을 두 개 두지 않아요.">
        <StateHeader />
        {BUTTON_VARIANTS.map((variant) => (
          <StateRow key={variant} label={variant}>
            <Button variant={variant} className={CELL}>
              저장
            </Button>
            <HoverSample>
              <Button variant={variant} tabIndex={-1} className={CELL}>
                저장
              </Button>
            </HoverSample>
            <Button variant={variant} disabled className={CELL}>
              저장
            </Button>
            <Button variant={variant} loading className={CELL}>
              저장
            </Button>
          </StateRow>
        ))}
        <h3 className="mt-6 text-sm font-semibold text-text-muted">크기</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm">sm 36</Button>
          <Button size="md">md 44</Button>
          <Button size="lg">lg 52</Button>
          <Button size="icon" aria-label="추가">
            +
          </Button>
        </div>
        <Button size="lg" fullWidth className="mt-3">
          fullWidth
        </Button>
        <Link href="/design" className={buttonClassName({ variant: "tonal", className: "mt-3" })}>
          Link 에 buttonClassName
        </Link>
      </Section>

      <Section title="Chip">
        <StateHeader labels={["기본", "hover", "선택", "비활성"]} />
        <StateRow label="chip">
          <Chip>전체</Chip>
          <HoverSample>
            <Chip tabIndex={-1}>전체</Chip>
          </HoverSample>
          <Chip selected>전체</Chip>
          <Chip disabled>전체</Chip>
        </StateRow>
      </Section>

      <Section title="IconButton" note="44px 고정. 아이콘만 있으니 aria-label 이 꼭 있어요.">
        <StateHeader labels={["기본", "hover", "비활성"]} />
        {(["default", "danger", "brand"] as const).map((tone) => (
          <StateRow key={tone} label={tone}>
            <IconButton tone={tone} aria-label={`${tone} 기본`}>
              <GuitarIcon className="size-5" />
            </IconButton>
            <HoverSample>
              <IconButton tone={tone} aria-label={`${tone} hover`} tabIndex={-1}>
                <GuitarIcon className="size-5" />
              </IconButton>
            </HoverSample>
            <IconButton tone={tone} aria-label={`${tone} 비활성`} disabled>
              <GuitarIcon className="size-5" />
            </IconButton>
          </StateRow>
        ))}
        <StateRow label="bare">
          <IconButton bare aria-label="bare 기본">
            <GuitarIcon className="size-5" />
          </IconButton>
          <HoverSample>
            <IconButton bare aria-label="bare hover" tabIndex={-1}>
              <GuitarIcon className="size-5" />
            </IconButton>
          </HoverSample>
          <IconButton bare aria-label="bare 비활성" disabled>
            <GuitarIcon className="size-5" />
          </IconButton>
        </StateRow>
      </Section>

      <Section title="Input" note="테두리는 border-input(3:1 이상), 포커스는 focus-ring, 오류는 danger 테두리와 aria-invalid.">
        <div className="space-y-3">
          <Input aria-label="기본" placeholder="곡 제목이나 유튜브 링크" />
          <Input aria-label="채움" defaultValue="데이식스 예뻤어" />
          <div>
            <Input aria-label="오류" invalid defaultValue="youtube.com/watch?v=" aria-describedby="design-input-error" />
            <p id="design-input-error" className="mt-1 text-sm text-danger-fg">
              유튜브 링크를 다시 확인해 주세요.
            </p>
          </div>
          <Input aria-label="비활성" disabled placeholder="비활성" />
          <Input aria-label="검색" pill placeholder="pill (검색)" />
        </div>
      </Section>

      <Section title="Card">
        <div className="space-y-3">
          {(["default", "elevated", "outline"] as const).map((variant) => (
            <Card key={variant} variant={variant}>
              <p className="text-sm font-semibold text-text">{variant}</p>
              <p className="text-sm text-text-muted">단톡방에 초대 링크를 보내면 바로 들어와요</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="ScreenToolbar">
        <div className="relative">
          <ScreenToolbar
            stat="12곡"
            caption="총 48분"
            actions={
              <IconButton bare aria-label="설정">
                <GuitarIcon className="size-5" />
              </IconButton>
            }
          />
        </div>
      </Section>

      <Section title="Dialog · Modal" note="확인창은 짧은 확인만. 위험 확인은 취소에 먼저 포커스가 가요.">
        <DialogDemo />
        <div className="mt-3">
          <ModalDemo />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-h2 font-bold text-text">{title}</h2>
      {note && <p className="mt-1 text-sm text-text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TokenLabel({ token }: { token: { name: string; value: string; utility: string; use: string } }) {
  return (
    <p className="mt-1 text-caption text-text-muted">
      <code className="text-text">{token.utility}</code> · {token.value} · {token.use}
    </p>
  );
}

const STATES = ["기본", "hover", "비활성", "로딩"];
/** A state cell narrow enough for four in a row at 390px. */
const CELL = "w-full px-0!";

function StateHeader({ labels = STATES }: { labels?: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 pl-16 text-caption text-text-muted">
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

function StateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-14 shrink-0 text-caption text-text-muted">{label}</span>
      <div className="grid flex-1 grid-cols-4 items-center justify-items-start gap-2">{children}</div>
    </div>
  );
}

function ColorRow({ token }: { token: ColorToken }) {
  return (
    <li className="flex gap-3 border-b border-border py-3">
      <span className="size-10 shrink-0 rounded-control border border-border" style={{ backgroundColor: token.hex }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">
          {token.name} <code className="font-normal text-text-muted">{token.hex}</code>
        </p>
        <p className="text-caption text-text-muted">{token.use}</p>
        {(token.pairs.length > 0 || token.avoid) && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {token.pairs.map((p) => (
              <PairTile key={p.against} token={token} pair={p} />
            ))}
            {token.avoid?.map((p) => (
              <PairTile key={p.against} token={token} pair={p} avoided />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** One combination drawn in its real colors, with its contrast. Inline styles: the hexes are data. */
function PairTile({ token, pair, avoided = false }: { token: ColorToken; pair: Pairing; avoided?: boolean }) {
  const other = COLORS.get(pair.against)!;
  const [fg, bg] = token.layer === "fg" ? [token, other] : [other, token];
  const ratio = contrastRatio(fg.hex, bg.hex);
  return (
    <li
      className={`flex items-center gap-1.5 rounded-badge px-2 py-1 text-caption ${avoided ? "line-through" : ""}`}
      style={{ backgroundColor: bg.hex, color: fg.hex, boxShadow: pair.min === 3 ? `inset 0 0 0 2px ${fg.hex}` : undefined }}
      title={`${fg.name} on ${bg.name}`}
    >
      <span className="font-semibold">{pair.against}</span>
      <span className="tabular-nums">
        {ratio.toFixed(2)}
        {avoided ? " 금지" : ""}
      </span>
    </li>
  );
}
