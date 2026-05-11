# Plypick — Release Checklist

ship 직전 마지막 점검표. 출시 시점에 한 번 위에서부터 통과시키며 진행.

---

## 1. 코드 안정성

- [ ] `npx tsc --noEmit` — 0 에러
- [ ] `npm run lint` — 0 에러 (warning 1건: QR `<img>` warning만 허용)
- [ ] `npm run dev` — 로컬 정상 동작 확인
- [ ] 빌드 빌드 통과:
      - 권장: Vercel preview deploy로 검증 (로컬 `next build`은 Next 16.2 `_global-error` 회귀로 실패 가능)
- [ ] 콘솔 에러 0 (브라우저 DevTools)

## 2. 데이터베이스 (Supabase)

- [ ] Production 프로젝트 ID 확인 (`NEXT_PUBLIC_SUPABASE_URL` 매칭)
- [ ] `supabase-schema.sql` 실행 (신규 환경만)
- [ ] 마이그레이션 v2 → v3 → v4 → v5 → v6 순서대로 실행 (모두 idempotent)
- [ ] RLS 활성화 확인:
      - `playlists` SELECT/INSERT public, UPDATE 없음
      - `playlist_admin` 정책 없음 = service_role만
      - `songs` SELECT/INSERT public
      - `votes` 전체 CRUD public
      - `comments` SELECT/INSERT public
      - `setlist_items` SELECT/INSERT public
- [ ] `playlists.votes_anonymous` 컬럼 존재 + DEFAULT TRUE 확인
- [ ] 인덱스 확인: `idx_songs_playlist_id`, `idx_songs_tempo_bpm`, `idx_songs_genre`

## 3. Vercel 환경변수 (Production)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Production only, Preview는 별도 키 권장)
- [ ] `CRON_SECRET` — `openssl rand -hex 32`로 생성. 미설정 시 cron 인증 자동 통과 (개발 편의), 프로덕션 필수
- [ ] 환경 스코프 (Production / Preview / Development) 분리 확인

## 4. Vercel 설정

- [ ] `vercel.json` 리전: `icn1` (한국 사용자 레이턴시 최소)
- [ ] `vercel.json` crons: `/api/cron/auto-confirm-setlist`, `0 * * * *`
- [ ] 배포 후 **Crons 탭**에서 매시간 트리거 활성화 확인
- [ ] **Functions 탭**에서 edge route 확인 (`/api/og`, `/api/setlist-image`, `/api/setlist-ics`)
- [ ] **Domains**: `plypick.kr` Production 연결, SSL 자동 갱신

## 5. 외부 통합

- [ ] **Kakao Developers**:
      - JavaScript 키 `src/app/layout.tsx`에 인라인 — 필요 시 환경변수화 검토
      - 플랫폼 → Web → 도메인에 `https://plypick.kr` + `http://localhost:3000` 등록
      - 카카오톡 공유 사용 신청 활성
- [ ] **YouTube oEmbed**: 인증 불필요, 동작 즉시
- [ ] **Pretendard CDN** (`cdn.jsdelivr.net`): 무료 + 안정
- [ ] **QR API** (`api.qrserver.com`): 무료, rate limit 관대

## 6. 분석 & 모니터링

- [ ] **Vercel Analytics** 활성 (Plan: Hobby도 기본 포함)
- [ ] **Speed Insights** 활성
- [ ] 출시 후 24h 안에 `playlist_created`, `vote_cast`, `kakao_shared` 이벤트 발화 확인
- [ ] UTM 자동 부착 확인: 카톡 공유 URL에 `utm_source=kakao&variant=X`

## 7. SEO & OG

- [ ] `src/app/layout.tsx` metadata: `metadataBase: https://plypick.kr`
- [ ] 홈 OG: `/api/og?variant=home&title=...` 1200×630 정상
- [ ] 플리 OG: `/api/og?variant=playlist&title=...` 정상
- [ ] 결정 OG: `/api/og?variant=decided&topSong=...` 정상
- [ ] 셋리스트 OG: `/api/og?variant=setlist&...` 정상
- [ ] 셋리스트 portrait: `/api/setlist-image/{shareCode}` 1080×1920 정상
- [ ] sitemap + robots: `src/app/sitemap.ts`, `src/app/robots.ts` 검증
- [ ] Google Search Console에 sitemap 제출
- [ ] 네이버 서치어드바이저 등록 + 메타 태그 인증

## 8. 모바일 호환

- [ ] **카카오톡 인앱 브라우저** 테스트:
      - 안드로이드 카톡 → 링크 클릭 → 정상 렌더
      - iOS 카톡 → 동일
      - QR 코드 스캔 → 정상
- [ ] **네이버 인앱 브라우저** 테스트
- [ ] **터치 영역 ≥44px** — 더보기 메뉴 / 모달 닫기 / 메타 편집 / 다이얼로그 버튼
- [ ] **safe-area-inset** — iPhone notch/홈 인디케이터 회피
- [ ] 가로 모드 회전 안 깨짐 (모바일 우선이지만 깨지면 안 됨)

## 9. 법적 / 정책 페이지

- [ ] `/about` — 서비스 소개 (current copy 확인)
- [ ] `/guide` — 사용 가이드
- [ ] `/privacy` — 개인정보처리방침. **수집 항목** (닉네임, 익명 투표, IP 분석) 명시
- [ ] `/terms` — 이용약관
- [ ] **광고 표기** — Vercel Analytics, Speed Insights 등 3rd party 추적 명시
- [ ] **카카오 공유 시 표기** — 외부 도구로 공유한다는 안내 (terms에 포함)

## 10. 보안 헤더

- [ ] `next.config.ts` headers 적용 중:
      - `X-Frame-Options: DENY` ✓
      - `X-Content-Type-Options: nosniff` ✓
      - `Referrer-Policy: strict-origin-when-cross-origin` ✓
      - `Permissions-Policy: camera=(), microphone=(), geolocation=()` ✓

## 11. 도그푸딩 (M0)

- [ ] 본인 밴드 단톡방에 `plypick.kr` 공유 후 5인 멤버 가입 없이 투표 1라운드 완료
- [ ] 결정 후 카톡 공유 카드 단톡방 노출 확인
- [ ] 셋리스트 확정 → 카톡/이미지/ICS export 1회씩 시도
- [ ] 합주실 실제 사용 시 메트로놈 + 합주 모드 동작 확인
- [ ] 본인이 발견한 막힌 지점 메모 → 다음 주 우선순위 1번에 투입

## 12. M1 (출시 후 7일)

- [ ] Vercel Analytics 대시보드에서 funnel 1차 확인:
      - 진입 → playlist_created 전환율
      - playlist_created → song_added 전환율
      - song_added → vote_cast 전환율
- [ ] 카톡 공유 클릭률 (UTM)
- [ ] 가입 밴드 ≥10팀 도달 시 인터뷰 5명 모집 (`docs/research/02.5-interview-kit.md` 참조)
- [ ] **SEO 콘텐츠 발행 시작** (`docs/research/08-content-plan.md` Pillar P1)
- [ ] 네이버 위성 블로그 셋업 (`docs/research/09-naver-seo.md`)

---

## 출시 공지 카피 (1탭 복사)

### 단톡방 / 카페 / 뮬

```
밴드에서 곡 정할 때마다 단톡방이 시끄럽지 않으세요?
"이번엔 뭐 할까", "다음 주에 정하자", "투표할까?" — 결국 못 정하고 끝.

저희 밴드도 그래서 만든 도구입니다 → plypick.kr

YouTube 링크 붙이고, 멤버에게 카톡으로 보내면 5분 안에 결정.
가입 X. 닉네임만.

가능하면 한 번 써보고 솔직한 의견 부탁드려요.
```

### Twitter / Threads / 인스타

```
밴드 곡 결정, 5분 컷.
plypick.kr
🎵 YouTube 링크 붙이기
👍 카톡으로 멤버 초대
🎉 5분 안에 다음 합주곡 결정

가입 없이 닉네임만. 한국 인디·취미 밴드를 위해 만들었어요.
```

---

## 출시 후 안 깨야 할 약속

- **익명 투표가 디폴트** — 새 기능 추가하다가 voter 닉네임 노출 디폴트로 바꾸지 말 것
- **가입 0 마찰** — 카카오 로그인 도입 시 반드시 *옵션*으로
- **카톡 공유는 빠르게** — 결정 직후 1탭으로 단톡방에 도달 가능해야 함
- **모바일 first** — 데스크톱 우선 디자인 회귀 X
- **한국어 카피 톤** — "스마트", "AI 추천" 류 마케팅 수사 금지

---

`/RELEASE.md`는 git tracked. 정책 변경 시 함께 업데이트.
