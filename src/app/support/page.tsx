import type { Metadata } from "next";
import Link from "next/link";
import Button, { KakaoMark, buttonClassName } from "@/components/ui/Button";
import FaqList from "@/components/ui/FaqList";
import { pageMetadata, type FaqEntry } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/support",
  title: "문의하기 - Plypick",
  description: "Plypick 자주 묻는 질문을 먼저 확인하고, 답이 없으면 카카오톡 채널로 물어보세요.",
});

const SUPPORT_FAQ: FaqEntry[] = [
  {
    question: "로그인 없이 투표할 수 있나요?",
    answer:
      "링크를 열어 보는 건 로그인 없이 돼요. 투표·곡 추가·댓글은 카카오 로그인이 필요하고, 닉네임은 카카오 프로필에서 가져와요. 로그인이 생기기 전에 만든 플레이리스트는 보관 상태라 지난 기록만 볼 수 있어요.",
  },
  {
    question: "익명 투표면 방장도 누가 뭘 찍었는지 모르나요?",
    answer:
      "네, 방장도 몰라요. 익명 투표에서는 누가 어느 곡에 표를 줬는지 서버가 아예 보내지 않아요. 투표권 할당 방식이면 방장은 멤버마다 몇 표 썼는지만 봐요. 방장이 기명 투표로 바꾸면 이미 한 표까지 닉네임과 찬반이 모두에게 보여요.",
  },
  {
    question: "한 사람이 몇 표까지 줄 수 있나요?",
    answer:
      "자유 투표는 곡마다 한 표예요. 같은 버튼을 다시 누르면 취소되고, 반대 버튼을 누르면 방향이 바뀌어요. 투표권 할당은 멤버마다 정해진 표 수 안에서 한 곡에 여러 표를 줄 수 있어요. 방식과 표 수는 방장이 정하고, 투표가 시작되면 방식은 바꿀 수 없어요.",
  },
  {
    question: "셋리스트는 누가 고칠 수 있나요?",
    answer:
      "새로 만든 플레이리스트는 방장만 고칠 수 있어요. 방장이 플레이리스트 설정에서 '모두 편집'으로 바꾸면 참여자 누구나 곡을 넣고 순서를 바꿀 수 있어요. 셋리스트 확정은 방장만 해요.",
  },
  {
    question: "플레이리스트를 지우고 싶어요",
    answer:
      "방장이 플레이리스트 설정 맨 아래 '플레이리스트 삭제'로 지울 수 있어요. 곡·투표·셋리스트·댓글이 함께 지워지고 되돌릴 수 없어요. 곡 하나만 지우려면 그 곡을 올린 사람이나 방장이 지우면 돼요.",
  },
  {
    question: "밴드 멤버는 어떻게 초대하나요?",
    answer:
      "밴드 화면의 '멤버 초대'에서 카카오톡으로 보내거나 링크를 복사해요. 받은 사람은 카카오 로그인 한 번이면 바로 들어와요. 초대 링크를 새로 만들면 예전 링크는 더 이상 열리지 않아요.",
  },
];

const LINKS = [
  { href: "/guide", label: "사용 가이드" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
];

function channelChatUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_CHAT_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export default function SupportPage() {
  const chatUrl = channelChatUrl();

  return (
    <main className="flex flex-1 flex-col bg-bg">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-12">
        <h1 className="break-keep text-h1 font-bold text-text">무엇을 도와드릴까요?</h1>
        <p className="mt-1 text-body text-text-muted">자주 묻는 질문부터 확인해 보세요.</p>

        <h2 className="mb-1 mt-8 text-caption font-semibold text-text-subtle">자주 묻는 질문</h2>
        <FaqList items={SUPPORT_FAQ} />

        <nav aria-label="Plypick 안내" className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-sm text-text-subtle transition-colors hover:text-text-muted">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {chatUrl ? (
            <a href={chatUrl} className={buttonClassName({ variant: "kakao", size: "lg", fullWidth: true })}>
              <KakaoMark />
              카카오톡으로 문의하기
            </a>
          ) : (
            <Button variant="kakao" size="lg" fullWidth disabled>
              카카오톡 채널을 준비하고 있어요
            </Button>
          )}
          <p className="mt-2 text-center text-caption text-text-subtle">
            {chatUrl ? "운영자가 직접 답해요 · 보통 하루 안에 답장이 와요" : "채널이 열리면 여기서 바로 물어볼 수 있어요"}
          </p>
        </div>
      </div>
    </main>
  );
}

