# GTM 컨테이너 설정

`gtm-container.json` 은 GA4 태그를 담은 Google 태그 관리자(GTM) 가져오기 파일이다. `src/lib/analytics.ts` 의
`EventMap` 으로 `node scripts/gtm-container.mjs` 가 만든다. 손으로 고치지 않고, `EventMap` 을 바꾸면 다시 만들어 다시 가져온다.
태그는 사이트가 `dataLayer` 에 넣는 가린 값(`/playlist/[code]` 같은)만 읽는다. GTM 의 기본 제공 변수 Page URL·Page Title 을
GA4 태그에 넣지 않는다. 그 값에는 공유 코드가 든 진짜 주소와 플레이리스트 제목이 있다.

## 가져오기

1. GTM 에서 컨테이너를 열고 **관리 › 컨테이너 가져오기** 로 이 파일을 고른다.
2. 작업공간은 **기존**(Default Workspace), 방식은 **병합 › 충돌하는 태그, 트리거, 변수 덮어쓰기**. GTM 은 이름으로 맞추므로
   다시 가져오면 이 파일의 항목만 새것으로 바뀐다.
3. 변수 **GA4 측정 ID** 의 `G-XXXXXXXXXX` 를 GA 의 **관리 › 데이터 스트림 › 웹 스트림** 에 있는 측정 ID 로 바꾼다. 바꿀 값은
   이것 하나다.
4. 같은 웹 스트림의 **향상된 측정 › 페이지 조회 › 고급 설정** 에서 「브라우저 기록 이벤트 기반 페이지 변경」을 끈다. 켜 두면 GA 가
   주소 바뀜을 스스로 읽어 페이지 보기를 따로 보낸다(Google 의 단일 페이지 앱 안내 1단계).

## 미리보기로 확인하기

미리보기는 컨테이너를 실은 화면이 있어야 해서 배포 전에는 로컬에서 본다.

1. `NEXT_PUBLIC_GTM_ID=GTM-… npm run dev` 로 띄운다.
2. GTM **미리보기** 에 `http://localhost:3000/playlist/abcd1234` 처럼 아무 코드나 넣은 주소를 연다.
3. Tag Assistant 의 `plypick_page_view` 에서 **GA4 - page_view** 가 실행됐는지, 변수 탭의 `DLV - page_location` 이
   `http://localhost:3000/playlist/[code]` 이고 `DLV - page_title` 이 「플레이리스트」인지 본다. 넣은 코드(`abcd1234`)는
   어느 태그 값에도 없어야 한다. **Initialization** 의 **Google 태그 - GA4** 도 같은 값을 받는다.

## 배포 순서

컨테이너를 **제출 › 게시** 한 뒤에 사이트를 배포한다. 사이트가 먼저 나가면 GA 로 직접 보내던 코드는 빠지고 GA4 태그는 아직
없어서, 그 사이 GA 기록이 빈다.
