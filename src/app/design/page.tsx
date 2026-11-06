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
import PlayPauseIcon from "@/components/ui/PlayPauseIcon";
import RoundButton, { ROUND_BARE_TONES, ROUND_DISC_TONES, ROUND_TOGGLE_ACCENTS, RoundLink, RoundRow } from "@/components/ui/RoundButton";
import ScreenToolbar, { ToolbarButton } from "@/components/ui/ScreenToolbar";
import { COLOR_GROUPS, COLORS, HEIGHTS, MOTION, RADII, SHADOWS, TYPE, contrastRatio, type ColorToken, type Pairing } from "@/components/ui/tokens";
import Avatar, { AvatarStack } from "@/components/ui/Avatar";
import Badge, { BADGE_TONES } from "@/components/ui/Badge";
import ButtonGroup from "@/components/ui/ButtonGroup";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import InlineNotice from "@/components/ui/InlineNotice";
import { RankNumber, SongRow } from "@/components/ui/ListRow";
import Textarea from "@/components/ui/Textarea";
import { DialogDemo, HoverSample, ListGroupDemo, ModalDemo, MotionDemo, NoticeDemo, SegmentedDemo, SongRowActionsDemo, SwitchDemo, TabBarDemo } from "./demos";

export const metadata: Metadata = {
  title: "디자인 시스템 · Plypick",
  robots: { index: false, follow: false },
};

export default function DesignPage() {
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
            <Button variant={variant} size="sm" fullWidth>
              저장
            </Button>
            <HoverSample>
              <Button variant={variant} tabIndex={-1} size="sm" fullWidth>
                저장
              </Button>
            </HoverSample>
            <Button variant={variant} disabled size="sm" fullWidth>
              저장
            </Button>
            <Button variant={variant} loading size="sm" fullWidth>
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
        <h3 className="mt-6 text-sm font-semibold text-text-muted">켜고 끄기</h3>
        <p className="mt-1 text-caption text-text-subtle">pressed 를 주면 켜진 쪽이 primary 예요. 글자는 그대로 둬서 켜고 꺼도 폭이 같아요.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="tonal" size="sm" pressed={false}>
            메트로놈
          </Button>
          <Button variant="tonal" size="sm" pressed>
            메트로놈
          </Button>
        </div>
        <Button size="lg" fullWidth className="mt-3">
          fullWidth
        </Button>
        <Link href="/design" className={buttonClassName({ variant: "tonal", className: "mt-3" })}>
          Link 에 buttonClassName
        </Link>
        <h3 className="mt-6 text-sm font-semibold text-text-muted">카카오 말풍선</h3>
        <p className="mt-1 text-caption text-text-subtle">카카오로 넘어가는 버튼은 말풍선을 붙여요. 노랑이 이미 있는 화면의 로그인은 tonal 에 kakaoMark.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="kakao">카카오로 시작하기</Button>
          <Button variant="tonal" size="sm" kakaoMark>
            로그인
          </Button>
        </div>
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

      <Section title="IconButton" note="md 44, sm 은 보이는 크기 36 에 누르는 영역 44×44 예요(36px 인터벌 카드의 ⊖). 아이콘만 있으니 aria-label 이 꼭 있어요.">
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
        <StateRow label="bare danger (빨강 글리프)">
          <IconButton bare tone="danger" aria-label="bare danger 기본">
            <MinusCircleIcon />
          </IconButton>
          <HoverSample>
            <IconButton bare tone="danger" aria-label="bare danger hover" tabIndex={-1}>
              <MinusCircleIcon />
            </IconButton>
          </HoverSample>
          <IconButton bare tone="danger" aria-label="bare danger 비활성" disabled>
            <MinusCircleIcon />
          </IconButton>
        </StateRow>
        <h3 className="mt-6 text-sm font-semibold text-text-muted">크기</h3>
        <StateHeader labels={["md 44", "sm 36", "인터벌 카드 안 sm"]} />
        <StateRow label="bare danger">
          <IconButton bare tone="danger" aria-label="md 삭제">
            <MinusCircleIcon />
          </IconButton>
          <IconButton bare tone="danger" size="sm" aria-label="sm 삭제">
            <MinusCircleIcon />
          </IconButton>
          <span className="col-span-2 flex min-h-control-sm items-center gap-3 whitespace-nowrap rounded-control bg-surface-hover px-3 text-sm text-text-muted">
            <IconButton bare tone="danger" size="sm" aria-label="카드 안 sm 삭제">
              <MinusCircleIcon />
            </IconButton>
            인터벌
          </span>
        </StateRow>
      </Section>

      <Section
        title="RoundButton · RoundLink · RoundRow"
        note="둥근 아이콘 버튼. 지름은 md 44 · lg 52 · hero 64 셋이고 글리프 크기는 버튼이 정해요(원판 없이 지름의 반, 원판 위 0.42). 플레이어·플레이리스트 머리·메트로놈 줄에서 써요. 시트·목록·폼의 네모 44 는 IconButton 이에요."
      >
        <StateHeader labels={["md 44", "lg 52", "hero 64"]} />
        {ROUND_BARE_TONES.map((tone) => (
          <StateRow key={tone} label={tone === "plain" ? "plain (재생 컨트롤 글리프)" : "ghost (Button ghost 와 같은 흐린 글리프)"}>
            <RoundButton tone={tone} size="md" aria-label={`${tone} md`}>
              <GuitarIcon />
            </RoundButton>
            <RoundButton tone={tone} size="lg" aria-label={`${tone} lg`}>
              <GuitarIcon />
            </RoundButton>
            <span className="text-caption text-text-subtle">원판이 없으면 hero 가 없어요</span>
          </StateRow>
        ))}
        {ROUND_DISC_TONES.map((tone) => (
          <StateRow key={tone} label={tone}>
            <RoundButton tone={tone} size="md" aria-label={`${tone} md`}>
              <GuitarIcon />
            </RoundButton>
            <RoundButton tone={tone} size="lg" aria-label={`${tone} lg`}>
              <GuitarIcon />
            </RoundButton>
            <RoundButton tone={tone} size="hero" aria-label={`${tone} hero`}>
              <PlayPauseIcon playing={false} />
            </RoundButton>
          </StateRow>
        ))}
        <h3 className="mt-6 text-sm font-semibold text-text-muted">상태</h3>
        <StateHeader labels={["기본", "hover", "비활성"]} />
        {[...ROUND_BARE_TONES, ...ROUND_DISC_TONES].map((tone) => (
          <StateRow key={tone} label={tone}>
            <RoundButton tone={tone} size="md" aria-label={`${tone} 기본`}>
              <GuitarIcon />
            </RoundButton>
            <HoverSample>
              <RoundButton tone={tone} size="md" aria-label={`${tone} hover`} tabIndex={-1}>
                <GuitarIcon />
              </RoundButton>
            </HoverSample>
            <RoundButton tone={tone} size="md" aria-label={`${tone} 비활성`} disabled>
              <GuitarIcon />
            </RoundButton>
          </StateRow>
        ))}
        <h3 className="mt-6 text-sm font-semibold text-text-muted">켜고 끄기</h3>
        <p className="mt-1 text-caption text-text-subtle">
          tone 대신 pressed 를 줘요. 꺼지면 ghost, 켜지면 primary-fg 글리프예요(셔플·한곡 반복). accent 가 켜진 색을 바꿔요. upvote·downvote 는
          투표 화살표이고, 켜지면 같은 색의 옅은 원판이 깔려요.
        </p>
        <StateHeader labels={["꺼짐", "켜짐"]} />
        {ROUND_TOGGLE_ACCENTS.map((accent) => (
          <StateRow key={accent} label={accent}>
            <RoundButton size="md" pressed={false} accent={accent} aria-label={`${accent} 꺼짐`}>
              <GuitarIcon />
            </RoundButton>
            <RoundButton size="md" pressed accent={accent} aria-label={`${accent} 켜짐`}>
              <GuitarIcon />
            </RoundButton>
          </StateRow>
        ))}
        <h3 className="mt-6 text-sm font-semibold text-text-muted">글자 글리프 · 링크</h3>
        <p className="mt-1 text-caption text-text-subtle">글자도 버튼이 크기를 정해요(md 18, lg 20). 링크는 RoundLink, edge=&quot;start&quot; 면 글리프가 내용 왼쪽 끝에 맞아요.</p>
        <div className="mt-2 flex items-center gap-2">
          <RoundButton tone="tonal" size="lg" aria-label="BPM 5 내리기">
            -5
          </RoundButton>
          <RoundButton tone="tonal" size="md" aria-label="BPM 1 내리기">
            -
          </RoundButton>
          <RoundLink href="/design" tone="ghost" size="md" aria-label="RoundLink">
            <GuitarIcon />
          </RoundLink>
        </div>
        <h3 className="mt-6 text-sm font-semibold text-text-muted">줄</h3>
        <p className="mt-1 text-caption text-text-subtle">원은 줄지 않고 간격이 줄어요. 줄 폭이 320 이상이면 간격 12, 좁으면 4 예요.</p>
        {(["w-72", "w-80"] as const).map((width) => (
          <div key={width} className={`mt-3 ${width} max-w-full outline-1 outline-dashed outline-border`}>
            <RoundRow>
              <RoundButton tone="kakao" size="lg" aria-label={`${width} 카카오`}>
                <GuitarIcon />
              </RoundButton>
              <RoundButton tone="tonal" size="lg" aria-label={`${width} 공지`}>
                <GuitarIcon />
              </RoundButton>
              <RoundButton tone="inverse" size="hero" aria-label={`${width} 재생`}>
                <PlayPauseIcon playing={false} />
              </RoundButton>
              <RoundButton tone="tonal" size="lg" aria-label={`${width} 보기`}>
                <GuitarIcon />
              </RoundButton>
              <RoundButton tone="tonal" size="lg" aria-label={`${width} 메뉴`}>
                <GuitarIcon />
              </RoundButton>
            </RoundRow>
          </div>
        ))}
      </Section>

      <Section title="Input" note="채움은 surface-hover, 테두리는 border-input(3:1 이상), 포커스는 focus-ring, 오류는 danger-fg 테두리와 aria-invalid. 글자는 16px(iOS 확대 방지).">
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
          <p className="text-caption text-text-subtle">pill 칸 옆 버튼은 Button 의 pill 로 모서리를 맞춰요 (곡 찾기).</p>
          <div className="flex gap-2">
            <Input aria-label="곡 찾기" pill placeholder="곡 이름이나 YouTube 링크" />
            <Button pill className="shrink-0">
              찾기
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Card">
        <div className="space-y-3">
          {(["default", "elevated", "outline", "selected"] as const).map((variant) => (
            <Card key={variant} variant={variant}>
              <p className="text-sm font-semibold text-text">{variant}</p>
              <p className="text-sm text-text-muted">단톡방에 초대 링크를 보내면 바로 들어와요</p>
            </Card>
          ))}
          <Card variant="selected" padding="sm" footer={<p className="p-3 text-sm text-text-muted">footer 는 카드 끝까지 닿아요</p>}>
            <p className="text-sm font-semibold text-text">footer</p>
            <p className="text-sm text-text-muted">펼친 코멘트처럼 카드 끝까지 닿는 아래 칸</p>
          </Card>
        </div>
      </Section>

      <Section title="ScreenToolbar" note="오른쪽 동작은 ToolbarButton 이에요. 모두 44px 이고, compact 는 640px 아래에서 아이콘만 남아요.">
        <div className="relative">
          <ScreenToolbar
            stat="48:10"
            caption="12곡 · 인터벌 2"
            actions={
              <>
                <ToolbarButton
                  label="셋리 전체 듣기"
                  compact
                  icon={
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  }
                />
                <ToolbarButton label="편집" />
                <ToolbarButton label="내보내기" />
              </>
            }
          />
        </div>
      </Section>

      <Section title="ButtonGroup" note="나란한 버튼 둘은 같은 폭·같은 높이. 주 동작은 오른쪽.">
        <ButtonGroup>
          <Button variant="tonal">취소</Button>
          <Button variant="danger">삭제</Button>
        </ButtonGroup>
      </Section>

      <Section title="Switch" note="켜고 끄기. 라벨을 주면 줄 전체가 눌러져요. 꺼진 트랙은 border-input 이라 3:1 이 나와요.">
        <SwitchDemo />
      </Section>

      <Section title="SegmentedControl" note="한 화면 안에서 하나를 고르는 라디오 묶음. 화살표 키로 옮기면 바로 골라져요. 고른 칸은 primary-tint 바탕에 on-primary-tint 글자, primary-fg 테두리예요. tint 는 트랙과 1.1:1 이라 테두리가 3:1 을 넘겨요.">
        <SegmentedDemo />
      </Section>

      <Section title="TabBar" note="화면 아래 dock. SegmentedControl 과 같은 모양이고 화면 전환이라 aria-current 로 말해요. 이 페이지 맨 아래에 붙어 있어요.">
        <TabBarDemo />
      </Section>

      <Section title="Badge" note="20px, 모서리 6. 메타는 neutral, 상태·개수는 primary, 주의는 warning.">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
          <Badge tone="primary">셋리스트</Badge>
          <Badge>BPM 107</Badge>
          <Badge>키 G</Badge>
          <Badge tone="warning">다른 버전 2</Badge>
          <Badge tone="primary">3</Badge>
        </div>
      </Section>

      <Section title="NoticeCard · InlineNotice" note="안내 카드는 늘 닫을 수 있어요. 카드의 동작은 tonal 이고, 카톡으로 보내는 동작만 kakao 예요. 상태가 이어지는 동안 남아야 하는 안내는 InlineNotice. InlineNotice 의 동작은 누르는 높이가 44px 이에요.">
        <NoticeDemo />
        <div className="mt-4 space-y-3">
          <InlineNotice>투표는 내일 오후 6시에 마감돼요.</InlineNotice>
          <InlineNotice tone="warning" action={<Link href="/design" className="text-sm font-semibold text-primary-fg">새 플레이리스트 만들기</Link>}>
            보관된 플레이리스트예요. 새로 투표하거나 곡을 추가할 수는 없어요.
          </InlineNotice>
        </div>
      </Section>

      <Section title="EmptyState" note="화면용은 아이콘 원 + 제목 + 설명 + 버튼 하나, 줄용은 한 줄.">
        <EmptyState
          icon={<GuitarIcon className="size-6" />}
          title="아직 후보곡이 없어요"
          description="단톡방에 링크를 보내 곡을 모아 보세요."
          action={<Button variant="tonal">링크 복사</Button>}
        />
        <EmptyState size="inline" description="아직 등록된 다른 버전이 없어요." className="mt-3" />
      </Section>

      <Section title="SongRow · RankNumber" note="곡 목록은 카드 없이 바탕 위 72px 행. 48px 커버, 고정 폭 순위 열, 오른쪽 점수·투표. 1~3위만 보라.">
        <div className="flex items-center gap-4">
          {[1, 2, 3, 4, 12].map((rank) => (
            <RankNumber key={rank} rank={rank} top={rank <= 3} />
          ))}
        </div>
        <div className="mt-3">
          {[
            ["낭만고양이", "체리필터 · 4:12", 6],
            ["예뻤어", "DAY6(데이식스) · 4:44", 1],
            ["그녀가 웃었다", "DAY6 · 3:23", -2],
          ].map(([title, meta, score], i) => (
            <SongRow key={title} rank={i + 1} topRank={Number(score) > 0 && i < 3} cover={<span className="absolute inset-0 bg-surface-hover" />} trailing={<Badge>{score}점</Badge>}>
              <p className="truncate text-body font-semibold text-text">{title}</p>
              <p className="truncate text-caption text-text-muted">{meta}</p>
            </SongRow>
          ))}
        </div>
        <p className="mt-4 text-caption font-semibold text-text-muted">펼치는 행 (SongRowTitleButton · ActionTabBar)</p>
        <p className="mt-1 text-caption text-text-subtle">
          제목 줄은 SongRowTitleButton(56px 이상)이에요. 펼친 아래 칸은 ActionTab 줄로, 바탕 없는 44px 탭이 폭을 나눠 가지고 끝에 ⋯ IconButton 이 와요.
          카드 보기도 같은 줄을 써요.
        </p>
        <SongRowActionsDemo />
      </Section>

      <Section title="ListRow · ListGroup · Avatar" note="설정·멤버는 56px 행을 묶음 카드로 감싸요 (Toss). 아바타는 겹쳐도 비치지 않아요.">
        <ListGroupDemo />
        <div className="mt-4 flex items-center gap-4">
          <Avatar name="창빈" />
          <Avatar name="민지" size="md" />
          <Avatar name="도윤" size="lg" />
          <AvatarStack names={["창빈", "민지", "도윤", "서연", "지호"]} />
        </div>
      </Section>

      <Section title="Field · Textarea" note="라벨은 위, 도움말·오류는 아래. 오류는 danger-fg 테두리와 aria-invalid.">
        <div className="space-y-4">
          <Field label="플레이리스트 이름" help="단톡방 카드 제목이 돼요.">
            <Input placeholder="어떤 합주예요? (예: 4월 정기 합주)" />
          </Field>
          <Field label="유튜브 링크" error="유튜브 링크를 다시 확인해 주세요.">
            <Input defaultValue="youtube.com/watch?v=" />
          </Field>
          <Field label="공지사항" help="최대 500자">
            <Textarea placeholder="다음 합주는 토요일 2시, 홍대 합주실이에요." />
          </Field>
        </div>
      </Section>

      <Section title="Dialog · Sheet" note="확인창은 짧은 확인만. 위험 확인은 취소에 먼저 포커스가 가요. Modal 은 모바일에서 그래버가 달린 시트(위 모서리 24, shadow-float)예요.">
        <DialogDemo />
        <div className="mt-3">
          <ModalDemo />
        </div>
      </Section>
    </main>
  );
}

function MinusCircleIcon() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M8 12h8" />
    </svg>
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

function StateHeader({ labels = STATES }: { labels?: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-caption text-text-muted">
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

function StateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-caption font-semibold text-text-muted">{label}</p>
      <div className="mt-1 grid grid-cols-4 items-center justify-items-start gap-2">{children}</div>
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
