# Music Vote

밴드 곡을 투표로 선정하세요. YouTube URL로 곡을 추가하고, 멤버들과 함께 업/다운 투표로 다음 공연 셋리스트를 정할 수 있습니다.

**[Live Demo](https://music-vote-ten.vercel.app)**

## Features

- **플레이리스트 생성** - 제목과 선택적 마감일을 설정하여 투표 플레이리스트 생성
- **YouTube 곡 추가** - URL을 붙여넣으면 제목/아티스트/썸네일 자동 추출
- **업/다운 투표** - 곡별 투표, 토글(취소), 방향 전환 지원
- **실시간 정렬** - 투표 점수 순으로 즉시 정렬 + 부드러운 애니메이션
- **뷰 모드 전환** - 컴팩트(리스트) / 카드(비디오) 뷰 토글
- **투표 마감일** - 선택적 마감일 설정, 마감 후 투표 자동 비활성화
- **QR 코드 공유** - 플레이리스트 생성 후 QR코드 + URL 복사 모달
- **결과 공유** - 투표 결과를 텍스트로 클립보드에 복사
- **동적 OG 이미지** - 플레이리스트별 미리보기 이미지 자동 생성
- **모바일 최적화** - 모바일 우선 반응형 UI, 터치 친화적
- **익명 참여** - 닉네임만 입력하면 바로 투표 참여

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel (Seoul region)
- **Animation:** @formkit/auto-animate

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase 프로젝트 ([supabase.com](https://supabase.com))

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/music-vote.git
cd music-vote
npm install
```

### Environment Variables

`.env.local` 파일을 생성하고 Supabase 자격 증명을 입력하세요:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Setup

Supabase SQL Editor에서 `supabase-schema.sql`을 실행하세요.

기존 v1에서 업그레이드하는 경우 `supabase-migration-v2.sql`도 실행하세요.

### Development

```bash
npm run dev
```

http://localhost:3000 에서 확인하세요.

### Deployment

```bash
vercel --prod
```

`vercel.json`에 서울 리전(`icn1`)이 설정되어 있습니다.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                       # 홈페이지 (CSS 3D 랜딩)
│   ├── api/og/route.tsx               # 동적 OG 이미지 API
│   └── playlist/[shareCode]/page.tsx  # 플레이리스트 페이지
├── actions/                           # Server Actions
│   ├── playlist.ts                    # 플리 생성/삭제
│   ├── song.ts                        # 곡 추가/삭제
│   └── vote.ts                        # 투표/토글/변경
├── components/                        # UI 컴포넌트
│   ├── PlaylistClient.tsx             # 플리 클라이언트 (정렬/애니메이션)
│   ├── SongCard.tsx                   # 곡 카드 (컴팩트/카드 뷰)
│   ├── VoteButtons.tsx                # 투표 버튼 (optimistic)
│   ├── CreatePlaylistForm.tsx         # 생성 폼 + QR 모달
│   └── ...
├── lib/
│   ├── supabase/                      # Supabase 클라이언트
│   ├── youtube.ts                     # YouTube URL 파싱 + oEmbed
│   └── types.ts                       # TypeScript 타입
└── middleware.ts                      # Rate limiting
```

## License

MIT
