// tools/check/check_law_urls.js — law.go.kr 한글주소 유효성 전수 검증
//
// law-links.js의 매핑 URL을 실제 호출해 ① HTTP 200 ② '한글주소명을 찾을 수 없습니다'
// 오류 페이지(200을 반환하므로 본문 검사 필수) ③ 문서명 키워드 포함을 확인한다.
// 법령·고시 폐지/명칭 변경으로 링크가 죽는 것을 조기 감지.
//
// 사용: node tools/check/check_law_urls.js  (종료코드 0=전부 유효, 1=끊어진 링크)

import { LAW_DOC_URLS } from '../../src/law-links.js';

const uniq = [...new Map(LAW_DOC_URLS.map(([pat, url]) => [url, pat])).entries()];

const results = await Promise.allSettled(uniq.map(async ([url, pat]) => {
    const res = await fetch(url, { redirect: 'follow' });
    const body = await res.text();
    // 오류 페이지도 200을 반환 → 본문 마커로 판정
    const broken = /한글\s*주소명을\s*찾을\s*수\s*없|주소명이\s*올바르지/.test(body);
    // 문서명이 본문에 포함되는지 (URL의 한글 세그먼트를 공백 무시 비교)
    const lawName = decodeURIComponent(url.split('/').pop());
    const squash = (s) => s.replace(/\s+/g, '');
    const found = squash(body).includes(squash(lawName));
    return { url, pat, status: res.status, ok: res.ok && !broken && found, broken, found };
}));

let fail = 0;
for (const r of results) {
    if (r.status !== 'fulfilled') { console.log(`  ✗ 네트워크 오류 — ${r.reason?.message}`); fail++; continue; }
    const v = r.value;
    if (v.ok) { console.log(`  ✓ ${v.pat} → ${v.url}`); continue; }
    fail++;
    const why = v.broken ? '한글주소 미존재(폐지/명칭변경?)' : (v.found ? `HTTP ${v.status}` : '문서명 본문 미포함');
    console.log(`  ✗ ${v.pat} → ${v.url} — ${why}`);
}

console.log(`\n검증 ${results.length}종 — 실패 ${fail}건`);
process.exit(fail ? 1 : 0);
