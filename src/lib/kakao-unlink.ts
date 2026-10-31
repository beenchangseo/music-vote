// 서버 전용. 카카오 어드민 키를 쓰므로 화면에서 import 하지 않는다.
// 카카오 로그인 정책: 서비스 탈퇴에는 연결 해제(unlink)가 들어가야 한다.
// https://developers.kakao.com/docs/ko/kakaologin/common
// Supabase 는 카카오 액세스 토큰을 보관하지 않아서 사용자 토큰 방식 대신 어드민 키 방식으로 끊는다.
// https://developers.kakao.com/docs/ko/kakaologin/rest-api

const UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";

// -101: the user is no longer linked to this app. -103: the Kakao account is dormant or deleted.
// Either way the link the unlink would cut is already gone.
const ALREADY_UNLINKED = new Set([-101, -103]);

export type KakaoUnlinkOutcome = "unlinked" | "not_configured" | "failed";

export async function unlinkKakaoUser(kakaoUserId: string): Promise<KakaoUnlinkOutcome> {
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (!adminKey) return "not_configured";

  try {
    const response = await fetch(UNLINK_URL, {
      method: "POST",
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams({ target_id_type: "user_id", target_id: kakaoUserId }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return "unlinked";
    const body = (await response.json().catch(() => null)) as { code?: number } | null;
    return body?.code !== undefined && ALREADY_UNLINKED.has(body.code) ? "unlinked" : "failed";
  } catch {
    return "failed";
  }
}
