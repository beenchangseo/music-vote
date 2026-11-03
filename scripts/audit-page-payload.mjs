#!/usr/bin/env node
// 로그아웃 방문자가 받는 플레이리스트 화면에 계정 식별자가 실리지 않는지 점검한다(docs/adr/0011). GET 만 보낸다.
//
//   npm run audit:payload                                   (운영 https://plypick.kr 의 qDPJnh1d)
//   AUDIT_SITE_URL=http://localhost:3000 npm run audit:payload
//   AUDIT_SHARE_CODE=<공유 코드> 로 다른 플레이리스트를 본다.
//
// 계약
//   - 페이지 HTML(서버 컴포넌트가 내려보내는 RSC 데이터 포함)에 계정 id 를 담는 필드 이름이 없다.
//   - 화면이 실시간 알림 뒤 다시 받는 GET route(셋리스트·댓글) 응답에도 없다.
//   필드 이름만 본다. 같은 값이 다른 이름으로 실리면 이 점검은 잡지 못하고, 페이지 테스트
//   (src/app/playlist/[shareCode]/__tests__/page.payload.test.tsx)가 잡는다.
//
// 값은 출력하지 않고 개수만 보여준다. 하나라도 실패하면 종료 코드 1.

const site = (process.env.AUDIT_SITE_URL || "https://plypick.kr").replace(/\/$/, "");
const shareCode = process.env.AUDIT_SHARE_CODE || "qDPJnh1d";

const ACCOUNT_FIELDS = ["creator_user_id", "added_by_user_id", "user_id", "currentUserId", "userId"];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

let failures = 0;

function report(label, status, detail) {
  if (status === "fail") failures += 1;
  const mark = { pass: "  통과", fail: "  실패", skip: "  건너뜀" }[status];
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Exact field names only, so user_id inside added_by_user_id is not counted twice. */
function fieldCounts(body) {
  const counts = {};
  for (const field of ACCOUNT_FIELDS) {
    const hits = body.match(new RegExp(`(?<![A-Za-z0-9_])${field}(?![A-Za-z0-9_])`, "g"))?.length ?? 0;
    if (hits > 0) counts[field] = hits;
  }
  return counts;
}

function check(label, body) {
  const counts = fieldCounts(body);
  const found = Object.entries(counts).map(([field, hits]) => `${field} ${hits}회`);
  report(label, found.length === 0 ? "pass" : "fail", found.join(", ") || undefined);
}

async function get(path) {
  const response = await fetch(`${site}${path}`, { headers: { "User-Agent": "plypick-audit-page-payload" } });
  return { status: response.status, body: await response.text() };
}

console.log(`로그아웃 페이지 계정 id 점검 (${new URL(site).host})\n`);

const page = await get(`/playlist/${shareCode}`);
if (page.status !== 200) {
  report(`/playlist/${shareCode}`, "fail", `status ${page.status}`);
} else {
  check(`/playlist/${shareCode} HTML·RSC 데이터`, page.body);

  // Songs carry their playlist_id, so a playlist with songs names the id its GET routes need.
  const playlistId = page.body.match(new RegExp(`playlist_id\\\\?"\\s*:\\s*\\\\?"(${UUID})`))?.[1];
  for (const route of ["setlist", "comments"]) {
    const label = `GET /api/playlist/{id}/${route}`;
    if (!playlistId) {
      report(label, "skip", "곡이 없어 플레이리스트 id 를 찾지 못함");
      continue;
    }
    const answer = await get(`/api/playlist/${playlistId}/${route}`);
    if (answer.status !== 200) report(label, "fail", `status ${answer.status}`);
    else check(label, answer.body);
  }
}

console.log(failures === 0 ? "\n모두 통과했습니다." : `\n${failures}건이 기대와 다릅니다.`);
process.exit(failures === 0 ? 0 : 1);
