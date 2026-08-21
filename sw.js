/* ============================================================
 * Cosmetic Pass — Service Worker
 * 맞춤형화장품 조제관리사 스마트 학습 플랫폼 PWA
 *
 * 캐시 전략:
 *  - App Shell (HTML/CSS/JS)      : Stale-While-Revalidate
 *  - 학습 데이터 (data/*.js)       : Cache First (거의 불변, 오프라인 핵심)
 *  - 외부 CDN (폰트/아이콘)        : Stale-While-Revalidate
 *  - MP3 오디오 (302MB)           : 네트워크 직행 (캐시 제외)
 *
 * ⚠️ 배포 시 CACHE_VERSION을 올려야 구 캐시가 정리됩니다.
 * ============================================================ */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `cosmetic-pass-shell-${CACHE_VERSION}`;
const DATA_CACHE = `cosmetic-pass-data-${CACHE_VERSION}`;
const CDN_CACHE = `cosmetic-pass-cdn-${CACHE_VERSION}`;

/** 설치 시 미리 캐시할 App Shell 목록 */
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/sanitize.js',
  './src/state.js',
  './src/charts.js',
  './src/scratchpad.js',
  './src/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/** 오프라인 학습 핵심 — 대용량 데이터 파일 */
const DATA_ASSETS = [
  './data/study_data.js',
  './data/exam_data.js',
  './data/ingredients_data.js',
  './data/audio_manifest.js'
];

/** 캐시하지 않을 요청 패턴 (오디오 등 대용량 미디어) */
const BYPASS_PATTERNS = [
  /\.mp3$/i,
  /audiobook\/mp3\//i
];

/** 외부 CDN 호스트 (Stale-While-Revalidate 대상) */
const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

/* ------------------------------------------------------------
 * install: App Shell + 데이터 프리캐시
 * ---------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
      caches.open(DATA_CACHE).then((cache) => cache.addAll(DATA_ASSETS))
    ]).then(() => self.skipWaiting())
  );
});

/* ------------------------------------------------------------
 * activate: 이전 버전 캐시 정리
 * ---------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, DATA_CACHE, CDN_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cosmetic-pass-') && !currentCaches.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------------------------
 * fetch: 요청 유형별 캐시 전략 적용
 * ---------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET 이외 메서드는 처리하지 않음
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) 오디오 등 대용량 미디어 → 캐시 우회 (네트워크 직행)
  if (BYPASS_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // 2) 외부 CDN (폰트/FontAwesome) → Stale-While-Revalidate
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE));
    return;
  }

  // 3) 동일 출처 요청만 처리 (그 외 cross-origin은 네트워크 직행)
  if (url.origin !== self.location.origin) return;

  // 4) 학습 데이터 파일 → Cache First
  // (루트/서브디렉터리 배포 모두 대응: 경로 어디에 있든 /data/ 세그먼트 매칭)
  if (url.pathname.includes('/data/')) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // 5) 그 외 App Shell (HTML/CSS/JS/아이콘) → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

/* ------------------------------------------------------------
 * 캐시 전략 구현
 * ---------------------------------------------------------- */

/** Cache First: 캐시 우선, 없으면 네트워크 후 캐시에 저장 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return offlineFallback(request);
  }
}

/** Stale-While-Revalidate: 캐시 즉시 반환 + 백그라운드 갱신 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // 캐시가 있으면 즉시 반환, 없으면 네트워크 대기
  return cached || (await networkPromise) || offlineFallback(request);
}

/** 오프라인 폴리백: 페이지 요청이면 캐시된 index.html 반환 */
async function offlineFallback(request) {
  if (request.mode === 'navigate') {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
  }
  return Response.error();
}
