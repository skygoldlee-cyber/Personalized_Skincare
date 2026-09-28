// tests/unit/pwa-sw.test.js — PWA·Service Worker 불변식 (정적 검증)
// @spec P-01,P-02,P-03,P-04,P-04a,P-05,P-06,P-07,P-08,P-09,P-10,P-11,P-12
// sw.js 캐시 전략 분기, 프리캐시 관용성, 스큐 방지, 업데이트 경로,
// 캐시 버전·프루닝, 설치 프롬프트 캡처·진단·인앱 감지,
// 매니페스트 Content-Type, 자가 복구, 자산 검증을 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf-8');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const capture = readFileSync(join(ROOT, 'src', 'pwa-install-capture.js'), 'utf-8');
const install = readFileSync(join(ROOT, 'src', 'pwa-install.js'), 'utf-8');

// ---------- P-01: 분기 전략 ----------

test('P-01: fetch 핸들러가 경로별 캐시 전략으로 분기한다', () => {
  assert.ok(sw.includes('cacheFirst'), 'cacheFirst 헬퍼');
  assert.ok(sw.includes('networkFirst'), 'networkFirst 헬퍼');
  assert.ok(sw.includes('staleWhileRevalidate'), 'staleWhileRevalidate 헬퍼');
  assert.ok(sw.includes("addEventListener('fetch'"), 'fetch 리스너');
  // 네비게이션·데이터·CDN·src 모듈 분기
  assert.ok(sw.includes('request.mode'), '요청 모드 분기');
});

// ---------- P-02: 프리캐시 관용성 ----------

test('P-02: 프리캐시가 precacheResilient + allSettled로 일부 실패를 견딘다', () => {
  assert.ok(sw.includes('precacheResilient'), 'resilient 프리캐시');
  assert.ok(sw.includes('Promise.allSettled'), 'allSettled 사용');
  assert.ok(sw.includes('SHELL_ASSETS'), 'App Shell 목록');
  assert.ok(sw.includes('DATA_ASSETS'), '데이터 번들 목록');
});

test('P-02: App Shell·데이터 자산 목록이 실제 파일을 가리킨다', () => {
  const shellBlock = sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\]/);
  assert.ok(shellBlock, 'SHELL_ASSETS 선언');
  const paths = [...shellBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1])
    .filter(p => p.startsWith('./') && p !== './');
  assert.ok(paths.length >= 10, 'App Shell 자산 목록');
  const missing = paths.filter(p => !existsSync(join(ROOT, p.slice(2))));
  assert.deepEqual(missing, [], `없는 App Shell 자산: ${missing.join(', ')}`);
});

// ---------- P-03: 네비게이션 Cache First (스큐 방지) ----------

test('P-03: 네비게이션 요청이 Cache First로 처리된다 (캐시 스큐 방지)', () => {
  assert.ok(/request\.mode === 'navigate'/.test(sw), 'navigate 분기');
  const navIdx = sw.indexOf("request.mode === 'navigate'");
  const after = sw.slice(navIdx, navIdx + 600);
  assert.ok(after.includes('cacheFirst'), 'navigate → cacheFirst');
});

// ---------- P-04: 업데이트 경로 ----------

test('P-04: skipWaiting + clients.claim으로 새 SW가 즉시 승격된다', () => {
  assert.ok(sw.includes('self.skipWaiting()'), 'skipWaiting');
  assert.ok(sw.includes('self.clients.claim()'), 'clients.claim');
});

test('P-04: controllerchange 자동 리로드가 조기 캡처 스크립트에 있다', () => {
  assert.ok(capture.includes('controllerchange'), 'controllerchange 리스너');
  assert.ok(/location\.reload|reload\(\)/.test(capture), '자동 리로드');
});

// ---------- P-04a: 업데이트 토스트 ----------

test('P-04a: SW 업데이트 토스트가 다운로드→설치→완료 단계를 표시한다', () => {
  assert.ok(capture.includes('sw-update-toast'), '토스트 요소');
  assert.ok(/다운로드|설치|완료|준비/.test(capture), '단계 메시지');
});

// ---------- P-05: CACHE_VERSION ----------

test('P-05: CACHE_VERSION이 스탬프 형식으로 선언되고 데이터 캐시와 분리된다', () => {
  const m = sw.match(/const CACHE_VERSION = '([^']+)'/);
  assert.ok(m, 'CACHE_VERSION 선언');
  assert.match(m[1], /^v\d*-?\d{8}-[0-9a-f]{7}$/, `스탬프 형식 아님: ${m[1]}`);
  const d = sw.match(/const DATA_CACHE_VERSION = '([^']+)'/);
  assert.ok(d, 'DATA_CACHE_VERSION 선언');
  assert.notEqual(d[1], m[1], '쉘/데이터 캐시 세대 분리');
  assert.ok(sw.includes('${CACHE_VERSION}'), '캐시명에 버전 반영');
});

// ---------- P-06: 구 해시 번들 프루닝 ----------

test('P-06: pruneStaleDataBundles가 activate에서 구 해시 번들을 정리한다', () => {
  assert.ok(sw.includes('function pruneStaleDataBundles'), '프루닝 함수');
  const act = sw.match(/addEventListener\('activate'[\s\S]{0,600}/);
  assert.ok(act && act[0].includes('pruneStaleDataBundles'), 'activate에서 호출');
});

// ---------- P-07: beforeinstallprompt 조기 캡처 ----------

test('P-07: beforeinstallprompt 캡처 스크립트가 <head> 클래식 스크립트로 로드된다', () => {
  const head = indexHtml.match(/<head[\s\S]*?<\/head>/);
  assert.ok(head, 'head 존재');
  assert.ok(head[0].includes('src="src/pwa-install-capture.js"'), 'head 내 조기 로드');
  assert.ok(!/type="module"[^>]*pwa-install-capture/.test(head[0]), '모듈이 아닌 클래식 스크립트');
  assert.ok(capture.includes('beforeinstallprompt'), '이벤트 캡처');
  assert.ok(capture.includes('e.preventDefault'), '기본 미니인포바 억제');
});

// ---------- P-08: 설치 진단 패널 ----------

test('P-08: 진단 패널이 SW 상태·display-mode·manifest를 검증한다', () => {
  assert.ok(install.includes('display-mode: standalone'), 'display-mode 확인');
  assert.ok(install.includes('serviceWorker'), 'SW 상태 확인');
  assert.ok(/manifest/.test(install), 'manifest 검증');
  assert.ok(install.includes('beforeinstallprompt'), 'prompt 캡처 상태 표시');
});

// ---------- P-09: 인앱 브라우저 감지 ----------

test('P-09: 인앱 브라우저 감지와 "다른 브라우저로 열기" 안내가 있다', () => {
  assert.ok(install.includes('inapp'), 'inapp 플랫폼 분기');
  assert.ok(/Kakao|Instagram|FBAN|wv|NAVER/i.test(install), '인앱 UA 패턴');
  assert.ok(/다른 브라우저로 열기|Chrome으로 열기/.test(install), '안내 문구');
});

// ---------- P-10: manifest.webmanifest Content-Type ----------

test('P-10: manifest.webmanifest에 application/manifest+json Content-Type이 명시된다', () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf-8'));
  const rule = (vercel.headers || []).find(h => h.source === '/manifest.webmanifest');
  assert.ok(rule, 'manifest.webmanifest 헤더 규칙');
  const ct = rule.headers.find(h => h.key === 'Content-Type');
  assert.ok(ct && ct.value.includes('application/manifest+json'), `Content-Type: ${ct && ct.value}`);
});

// ---------- P-11: 자가 복구 (app-fallback.js) ----------

test('P-11: app-fallback.js가 SW update→하드 리셋→수동 복구 단계로 복구한다', () => {
  const fb = readFileSync(join(ROOT, 'src', 'app-fallback.js'), 'utf-8');
  assert.ok(fb.includes('__APP_INITIALIZED'), '정상 초기화 감지 플래그');
  assert.ok(fb.includes('softUpdateThenReload'), '1차: SW update + reload');
  assert.ok(fb.includes('hardReset'), '2차: 캐시/SW 하드 리셋');
  assert.ok(fb.includes('showManualRecovery'), '3차: 수동 복구 화면');
  assert.ok(fb.includes('MAX_RELOADS'), '반복 실패 상한');
  // index.html에서 ESM 로더와 병행 로드
  assert.ok(indexHtml.includes('src/app-fallback.js'), 'index.html 병행 로드');
});

// ---------- P-12: 프리캐시 자산 CI 검증 ----------

test('P-12: verify_shell_assets.js가 존재하고 CI·npm 스크립트에 연결된다', async () => {
  const { execFileSync } = await import('node:child_process');
  const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf-8');
  assert.ok(/verify:assets/.test(ci), 'CI에 verify:assets 스텝');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  assert.ok(/verify_shell_assets/.test(pkg.scripts['verify:assets']), 'npm 스크립트 연결');
  // 실제 실행 — 프리캐시 목록과 파일이 일치해야 함
  const out = execFileSync(process.execPath, [join(ROOT, 'tools', 'check', 'verify_shell_assets.js')], { encoding: 'utf-8' });
  assert.ok(!/누락|missing|FAIL/i.test(out), `자산 검증 출력: ${out}`);
});
