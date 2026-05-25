"use client";

import Script from "next/script";

// 카카오 JS SDK 로드 + 초기화.
// init 을 SDK 의 onLoad 콜백에서 호출해 "SDK 로드 → init" 순서를 보장한다.
// (이전: SDK 스크립트와 별도 init 스크립트가 둘 다 lazyOnload 라 순서 레이스로
//  init 이 SDK 로드 전에 돌고 건너뛰어 Kakao.Share 가 끝내 생성되지 않았음.)
const KAKAO_JS_KEY = "6ef9ea89e2ff04b09dc1d8d8cebd3f90"; // 공개용 JS 앱키 (브라우저 노출 정상)

type KakaoSDK = { isInitialized(): boolean; init(key: string): void };

export default function KakaoInit() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka"
      crossOrigin="anonymous"
      strategy="lazyOnload"
      onLoad={() => {
        const k = (window as unknown as { Kakao?: KakaoSDK }).Kakao;
        if (k && !k.isInitialized()) k.init(KAKAO_JS_KEY);
      }}
    />
  );
}
