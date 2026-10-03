// tests/unit/security.test.js — 보안 불변식 (정적 검증)
// @spec S-01,S-07,S-08
// CSP script-src 정책, 배포 보안 헤더, window 브리지 위임 경로를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf-8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
// 지연 주입 뷰 파셜(data-lazy-view) — practice-registry가 런타임 주입하는
// 배포 마크업이므로 index.html과 동일한 보안 스캔 대상이다.
// 시험별 도메인 파셜(html/exams/<id>/)도 대상이므로 html/ 전체를 재귀 수집한다.
const collectHtmlFiles = (dir) => readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory()
        ? collectHtmlFiles(join(dir, e.name))
        : (e.name.endsWith('.html') ? [join(dir, e.name)] : []));
const allMarkup = indexHtml + '\n' + collectHtmlFiles(join(ROOT, 'html'))
    .map(f => readFileSync(f, 'utf-8'))
    .join('\n');
const appJs = readFileSync(join(ROOT, 'src', 'app.js'), 'utf-8');
// 실무 피처 지연 핸들러명은 practice-registry.js가 선언 소유 — 브리지 탐색 범위에 포함
const handlerSources = appJs + readFileSync(join(ROOT, 'src', 'practice-registry.js'), 'utf-8');

function headerValue(name) {
  for (const group of vercel.headers || []) {
    for (const h of group.headers || []) {
      if (h.key.toLowerCase() === name.toLowerCase()) return h.value;
    }
  }
  return null;
}

// ---------- S-01: CSP script-src ----------

test('S-01: CSP에 script-src 정책이 있고 unsafe-inline을 허용하지 않는다', () => {
  const csp = headerValue('Content-Security-Policy');
  assert.ok(csp, 'CSP 헤더 필수');
  const m = csp.match(/script-src\s+([^;]+)/);
  assert.ok(m, 'script-src 지시문');
  assert.ok(m[1].includes("'self'"), "script-src에 'self'");
  assert.ok(!m[1].includes('unsafe-inline'), 'script-src unsafe-inline 금지');
  assert.ok(!m[1].includes('unsafe-eval'), 'script-src unsafe-eval 금지 — eval()·new Function() 차단');
  assert.ok(!indexHtml.match(/<script(?![^>]*src=)[^>]*>[^<\s]/), '인라인 스크립트 실행 없음');
});

test('S-01: data-click 위임 패턴이 인라인 핸들러를 대체한다 (on*= 부재)', () => {
  const inlineHandlers = allMarkup.match(/\son\w+\s*=/g) || [];
  assert.deepEqual(inlineHandlers, [], `인라인 핸들러 잔존: ${inlineHandlers.join(', ')}`);
  assert.ok(indexHtml.includes('data-click'), 'data-click 위임 사용');
});

// ---------- S-07: 보안 헤더 ----------

test('S-07: 배포 헤더에 nosniff·Referrer-Policy·프레임 보호가 있다', () => {
  assert.equal(headerValue('X-Content-Type-Options'), 'nosniff');
  assert.ok(headerValue('Referrer-Policy'), 'Referrer-Policy');
  // X-Frame-Options 또는 CSP frame-ancestors 로 클릭재킹 방지
  const xfo = headerValue('X-Frame-Options');
  const csp = headerValue('Content-Security-Policy') || '';
  assert.ok(
    xfo === 'DENY' || /frame-ancestors\s+'none'/.test(csp),
    'X-Frame-Options: DENY 또는 frame-ancestors none 필요'
  );
});

test('S-07: Permissions-Policy가 민감 API를 제한한다', () => {
  const pp = headerValue('Permissions-Policy');
  assert.ok(pp, 'Permissions-Policy 헤더');
  assert.ok(pp.includes('geolocation=()'), 'geolocation 차단');
  assert.ok(pp.includes('camera=()'), 'camera 차단');
});

// ---------- S-08: window 브리지 ----------

test('S-08: DELEGATED_HANDLERS 맵이 window 브리지로 노출된다', () => {
  assert.ok(appJs.includes('const DELEGATED_HANDLERS'), '핸들러 맵 선언');
  // 맵의 엔트리가 window에 할당되는 경로 확인
  assert.ok(/Object\.assign\(window|window\[\w+\]\s*=|for.*DELEGATED_HANDLERS/.test(appJs), 'window 브리지 할당');
});

test('S-08: HTML의 data-click 핸들러명이 브리지·네임스페이스에 해석 가능하다', () => {
  const names = new Set([...allMarkup.matchAll(/data-click="([^"]+)"/g)].map(m => m[1]));
  const missing = [...names].filter(n => {
    const top = n.split('.')[0];
    // 네임스페이스 호출(X.y)은 window.X 객체만 필요 — app.js·레지스트리에 선언 존재 확인
    if (!handlerSources.includes(top)) {
      // index.html 클래식 스크립트 전역 (window.*) 도 허용
      const globals = ['openExternalLink'];
      return !globals.includes(top);
    }
    return false;
  });
  assert.deepEqual(missing, [], `해석 불가 핸들러: ${missing.join(', ')}`);
});
