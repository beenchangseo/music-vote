import { getCurrentUser } from "@/lib/auth";
import AuthMenu from "./AuthMenu";

export default async function AuthButton() {
  const user = await getCurrentUser();

  // 비로그인 사용자에겐 우상단 버튼 숨김.
  // 진입로는 HeroCTA, /new 게이트, Invitation banner 가 담당.
  if (!user) return null;

  return <AuthMenu nickname={user.nickname} avatarUrl={user.avatarUrl} />;
}
