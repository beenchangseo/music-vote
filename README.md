# Plypick

밴드 곡을 투표로 결정하세요. YouTube 링크를 붙이면 멤버들이 가입 없이 5분 안에 다음 합주 곡을 정합니다.

**Live:** [plypick.kr](https://plypick.kr)

> *"카톡 단톡방에서 '다음 주에 정하기로' 끝나던 곡 결정을, 5분 만에 끝내는 밴드 투표 도구."*

---

## Features

### 코어
- **5분 컷 투표** — 가입 없이 닉네임만으로 업/다운 투표, 토글·방향 전환 지원
- **YouTube 자동 메타** — URL 붙이면 제목·아티스트·썸네일 자동
- **5중 제약 곡 메타** — 키(C~B + Major/minor), BPM, 길이, 난이도(1~5★), 장르 12종
- **5축 필터** — BPM 구간 / 메타 유무 / 키 / 난이도 ≤ / 장르 다중 선택
- **실시간 정렬** — 점수순 자동 정렬 + auto-animate
- **댓글** — 곡당 1인 1댓글 + 카드 표면 카운트 배지
- **익명/기명 모드 토글** — 방장 admin 권한, 기명 시 voter 닉네임 노출

### 셋리스트
- **마감 후 자동 확정** — Vercel Cron 매시간 상위 N곡 자동 셋리스트 등록
- **수동 확정** — 방장이 즉시 확정 가능
- **인터벌 블럭** — 합주 사이 휴식 시간 삽입 + 러닝타임 자동 계산
- **합주 모드** — 메트로놈 + 자동 진행

### 공유 & Export
- **카카오톡 리치 카드** — 4-variant OG (home/playlist/decided/setlist), Pretendard ExtraBold
- **3-fallback 공유 체인** — Kakao Share → Web Share → Clipboard
- **셋리스트 포트레이트 이미지** — 1080×1920 PNG (모바일 갤러리 저장 + 카톡)
- **인쇄 / PDF** — 전용 print CSS
- **합주 일정 ICS** — RFC 5545 캘린더 파일 다운로드 (날짜·시간·길이·장소)
- **외부 악보 단축** — Ultimate Guitar / Chordify / 뮤직노트 / 악보바다

### 디자인
- **Pretendard Variable** 동적 서브셋 (한국어 가독성)
- **시맨틱 컬러 토큰** (`text-text-muted`, `bg-surface-hover` 등)
- **모바일 터치 영역 ≥44px** + safe-area-inset 지원
- **UI primitives**: Button / Input / Card / Modal

### 운영
- **분석 이벤트** — 9종 (`playlist_created`, `song_added`, `vote_cast`, `kakao_shared`, `setlist_confirmed`, `setlist_exported`, `meta_edited`, `filter_applied`, `vote_changed`)
- **UTM 자동 부착** — 카톡 공유 시 variant별 추적

---

## Tech Stack

| 영역 | 기술 |
|---|---|
| Framework | Next.js 16 App Router |
| Runtime | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (@theme inline) |
| Font | Pretendard Variable (CDN dynamic subset) |
| Database | Supabase Postgres + RLS |
| Auth | Anonymous (admin_token 분리 테이블) |
| Image | next/image + next/og (Edge) |
| Analytics | @vercel/analytics + Speed Insights |
| Cron | Vercel Cron (icn1 region) |
| Animation | @formkit/auto-animate |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Supabase 프로젝트 ([supabase.com](https://supabase.com))
- Kakao Developers 앱 (선택, 카톡 공유)

### Installation
```bash
git clone https://github.com/YOUR_USERNAME/music-vote.git
cd music-vote
npm install
```

### Environment Variables

`.env.local`:
```
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vercel Cron 인증 (프로덕션에서 권장)
CRON_SECRET=randomly-generated-32-char-hex
```

> Kakao JavaScript SDK 키는 현재 `src/app/layout.tsx`에 인라인. 별도 환경변수화는 향후 작업.

### Database Setup

Supabase SQL Editor에서 순서대로 실행:
```
supabase-schema.sql           # v1 베이스 스키마
supabase-migration-v2.sql     # admin_token 분리
supabase-migration-v3.sql     # 댓글 + 셋리스트
supabase-migration-v4.sql     # creator_nickname + 공지사항
supabase-migration-v5.sql     # 5중 제약 메타 (key_root/mode, difficulty, genre)
supabase-migration-v6.sql     # 익명/기명 투표 모드
...
...
```

기존 운영 DB는 이미 실행한 마이그레이션을 건너뛸 수 있도록 모두 `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` 패턴 사용.

### Development
```bash
npm run dev
```
http://localhost:3000

### Deployment
```bash
vercel --prod
```

`vercel.json`에 서울 리전(`icn1`) + 매시간 cron 등록:
```json
{
  "regions": ["icn1"],
  "crons": [
    { "path": "/api/cron/auto-confirm-setlist", "schedule": "0 * * * *" }
  ]
}
```

Vercel Dashboard에서 환경변수(`CRON_SECRET`) 설정 후 첫 배포 시 Crons 탭에서 활성화 확인.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                              # 랜딩 (5분 컷 후킹)
│   ├── new/page.tsx                          # 전용 생성 페이지 (URL fallback)
│   ├── about/, guide/, privacy/, terms/      # 법적/안내 페이지
│   ├── global-error.tsx, not-found.tsx       # 명시적 에러/404
│   ├── playlist/[shareCode]/
│   │   ├── page.tsx                          # 플리 서버 컴포넌트 (스코어·댓글 카운트 join)
│   │   └── metronome/                        # 메트로놈
│   └── api/
│       ├── og/                               # 4-variant OG 이미지
│       ├── setlist-image/[shareCode]/        # 1080×1920 포트레이트 PNG
│       ├── setlist-ics/[shareCode]/          # RFC 5545 캘린더
│       └── cron/auto-confirm-setlist/        # Vercel Cron 자동 확정
├── actions/                                  # Server Actions
│   ├── playlist.ts                           # 생성·삭제·공지·투표 모드
│   ├── song.ts                               # 추가·삭제·메타 업데이트
│   ├── vote.ts                               # 투표 cast/toggle
│   ├── comment.ts                            # 댓글
│   └── setlist.ts                            # 셋리스트 항목·순서
├── components/
│   ├── ui/                                   # Primitives
│   │   ├── Button.tsx, Input.tsx, Card.tsx, Modal.tsx
│   ├── PlaylistClient.tsx                    # 메인 클라이언트 컴포넌트
│   ├── PlaylistHeader.tsx, NavigationBar.tsx
│   ├── AddSongForm.tsx, SongCard.tsx, SongMeta.tsx
│   ├── VoteButtons.tsx, FilterBar.tsx
│   ├── KakaoShareButton.tsx                  # 3-fallback 공유
│   ├── HeroCTA.tsx, LivePreview.tsx          # 랜딩 후킹
│   ├── SetlistView.tsx, SetlistCalendarButton.tsx, RehearsalView.tsx
│   ├── SheetMusicLinks.tsx                   # 외부 악보 검색
│   ├── VotingModeToggle.tsx                  # 익명/기명 토글
│   ├── CommentSection.tsx, CommentModal.tsx
│   └── DialogProvider.tsx, Toast.tsx, MetronomeClient.tsx, MiniPlayer.tsx
├── lib/
│   ├── supabase/                             # Server / Client / Admin
│   ├── youtube.ts, youtube-iframe.ts         # oEmbed + IFrame API
│   ├── song-meta.ts                          # KEY_ROOTS / GENRES + format / validate
│   ├── analytics.ts                          # 타입 안전 track() wrapper
│   ├── invidious.ts                          # 메타 fallback
│   └── types.ts
└── middleware.ts                             # Rate limiting
```

---

## Analytics Events

`src/lib/analytics.ts`의 `track()`은 타입 안전. Vercel Analytics 대시보드에서 다음 이벤트 자동 노출:

| Event | Properties |
|---|---|
| `playlist_created` | `has_deadline`, `setlist_count` |
| `song_added` | `has_thumbnail` |
| `vote_cast` / `vote_toggled` / `vote_changed` | `vote_type` / `from`+`to` |
| `kakao_shared` | `variant` (playlist/decided/setlist) |
| `setlist_confirmed` | `song_count`, `auto` |
| `setlist_exported` | `format` (print/image/ics) |
| `meta_edited` | `field` (key/bpm/difficulty/genre/...) |
| `filter_applied` | `type` (bpm/meta_only/key/difficulty/genre) |

UTM은 모든 카톡 공유 URL에 자동 부착:
```
?utm_source=kakao&utm_medium=share&utm_campaign={shareCode}&variant=decided
```

---

## License

MIT
