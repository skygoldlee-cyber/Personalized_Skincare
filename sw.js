/* ============================================================
 * Cosmetic Pass — Service Worker
 * 맞춤형화장품 조제관리사 스마트 학습 플랫폼 PWA
 *
 * 캐시 전략:
 *  - App Shell (HTML/CSS/JS)      : Network First / SWR (배포 시 CACHE_VERSION 갱신)
 *  - 레지스트리 (registry.js)      : Network First (항상 최신 번들 URL 확보)
 *  - 학습 데이터 번들 (해시 파일명) : Cache First + 온디맨드 캐싱 (변경분만 새 URL로 갱신)
 *  - 외부 CDN (폰트/아이콘)        : Stale-While-Revalidate
 *  - MP3 오디오 (302MB)           : 네트워크 직행 (캐시 제외)
 *
 * ⚠️ 캐시 버전 규약 (MODULAR_DESIGN 4-3):
 *   - CACHE_VERSION(쉘/CDN)은 배포마다 갱신 → 코드/HTML은 항상 최신.
 *   - DATA_CACHE_VERSION(데이터)은 "안정" 이름으로, 콘텐츠 변경 시 올리지 않음.
 *     번들 파일명에 콘텐츠 해시가 포함되므로 변경된 과목만 새 URL이 되어
 *     Cache First로 자연 갱신되고, 미변경 번들 캐시는 배포 간 그대로 유지된다.
 *     (구 해시 번들은 activate의 pruneStaleDataBundles가 레지스트리 기준으로 정리)
 * ============================================================ */

const CACHE_VERSION = 'v24-20260825';       // 쉘/CDN: 배포마다 갱신 (유연한 아키텍처 리팩토링 반영)
const DATA_CACHE_VERSION = 'v1';           // 데이터: 안정(해시 파일명이 변경 감지 담당) — 캐시 포맷이 바뀔 때만 수동 증가
const SHELL_CACHE = `cosmetic-pass-shell-${CACHE_VERSION}`;
const DATA_CACHE = `cosmetic-pass-data-${DATA_CACHE_VERSION}`;
const CDN_CACHE = `cosmetic-pass-cdn-${CACHE_VERSION}`;

/** 설치 시 미리 캐시할 App Shell 목록 */
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './ping.txt',
  './src/theme-init.js',
  './src/sanitize.js',
  './src/state.js',
  './src/charts.js',
  './src/scratchpad.js',
  './src/utils.js',
  './src/trainer-calc.js',
  './src/reader-format.js',
  './src/exam-viewer.js',
  './src/manual-viewer.js',
  './src/markdown-parser.js',
  './src/data-loader.js',
  './src/sha256.js',
  './src/textbook-parser.js',
  './src/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // FontAwesome 자체 호스팅 (오프라인/모바일에서도 아이콘 확실히 표시)
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  // Noto Sans KR & Outfit 웹폰트 자체 호스팅
  './vendor/fonts/fonts.css',
  './vendor/fonts/noto-sans-kr-300.woff2',
  './vendor/fonts/noto-sans-kr-400.woff2',
  './vendor/fonts/noto-sans-kr-500.woff2',
  './vendor/fonts/noto-sans-kr-700.woff2',
  './vendor/fonts/noto-sans-kr-900.woff2',
  './vendor/fonts/outfit-300.woff2',
  './vendor/fonts/outfit-400.woff2',
  './vendor/fonts/outfit-600.woff2',
  './vendor/fonts/outfit-800.woff2',
  // Mermaid 자체 호스팅 (오프라인/모바일에서도 다이어그램 정상 표시)
  './vendor/mermaid/mermaid.min.js'
];

/**
 * 설치 시 프리캐시할 "경량" 데이터만 나열한다 (MODULAR_DESIGN 4-3).
 * 무거운 과목/시험/원료 번들은 해시 파일명 + fetch 핸들러의 Cache First
 * 온디맨드 캐싱으로 처리하므로 여기에 넣지 않는다.
 *   - 장점: 배포마다 전체(~2MB) 재프리캐시/재다운로드가 사라짐, 변경 과목만 갱신.
 *   - 트레이드오프: 아직 방문하지 않은 과목은 최초 1회 온라인 접속 시 캐시됨
 *     (그 전까지는 오프라인 미가용). 전체 오프라인 선(先)확보가 필요하면
 *     이 배열에 번들을 다시 추가할 수 있으나, 그 경우 변경-격리 이점을 일부 포기한다.
 */
const DATA_ASSETS = [
  './data/registry.js',
  './data/audio_manifest.js'
];

/** 캐시하지 않을 요청 패턴 (오디오 등 대용량 미디어) */
const BYPASS_PATTERNS = [
  /\.mp3$/i,
  /content\/audiobook\/mp3\//i
];

/** 마크다운 원본 → Cache First (정적 원본, 배포 시 갱신) */
const MD_PATTERN = /\.md$/i;

/** 외부 CDN 호스트 (Stale-While-Revalidate 대상) */
const CDN_HOSTS = [
  // 외부 폰트/서체 CDN 사용 제거됨 (100% 로컬 자체 호스팅)
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
  // DATA_CACHE는 "안정" 이름이라 배포 간 유지된다 (통째 삭제하지 않음).
  // 구 버전 쉘/CDN 캐시만 제거하고, 데이터 캐시 내부는 레지스트리 기준으로 고아만 정리한다.
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
      .then(() => pruneStaleDataBundles())
      .then(() => self.clients.claim())
  );
});

/**
 * 데이터 캐시는 배포 간 유지되므로, 최신 레지스트리가 더 이상 참조하지 않는
 * 구 해시 번들만 선별 삭제한다. 실패해도 무해한 best-effort (fetch 경로 영향 없음).
 * 루트/서브디렉터리 배포 모두 대응하기 위해 경로 끝 일치로 비교한다.
 */
async function pruneStaleDataBundles() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const res = await fetch('./data/registry.js', { cache: 'no-cache' });
    if (!res || !res.ok) return;
    const text = await res.text();

    // 레지스트리가 참조하는 모든 ./data/*.js 경로 수집 (+ 항상 보존할 경량 파일)
    const referenced = new Set(text.match(/\.\/data\/[A-Za-z0-9_./-]+\.js/g) || []);
    referenced.add('./data/registry.js');
    referenced.add('./data/audio_manifest.js');
    const refSuffixes = [...referenced].map((r) => r.replace(/^\.\//, '/'));

    const requests = await cache.keys();
    await Promise.all(
      requests.map(async (req) => {
        const pathname = new URL(req.url).pathname;
        if (!pathname.includes('/data/')) return; // 데이터 번들만 대상
        const isReferenced = refSuffixes.some((suffix) => pathname.endsWith(suffix));
        if (!isReferenced) await cache.delete(req);
      })
    );
  } catch (e) {
    // best-effort: 실패 시 아무 것도 하지 않음
  }
}

/* ------------------------------------------------------------
 * fetch: 요청 유형별 캐시 전략 적용
 * ---------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET 이외 메서드는 처리하지 않음
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 0) 연결 프로브(?_probe=) → 서비스 워커가 직접 네트워크에서 패치하여 반환.
  //    (일부 모바일 WebKit/웹뷰 standalone 환경에서 respondWith 없이 return하면
  //     네트워크 요청이 실패/차단되는 현상을 방지)
  if (url.searchParams.has('_probe')) {
    event.respondWith(fetch(request));
    return;
  }

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

  // 3-1) 페이지 네비게이션(HTML 문서) → Network First
  // (배포 직후 구버전 HTML이 SW 캐시에서 제공되는 것을 방지.
  //  온라인이면 항상 최신 HTML, 오프라인이면 캐시 폴리백)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // 4) 학습 데이터 파일 → Cache First (단, registry.js는 최신 변경사항 확인을 위해 Network First 적용)
  // (루트/서브디렉터리 배포 모두 대응: 경로 어디에 있든 /data/ 세그먼트 매칭)
  if (url.pathname.includes('/data/')) {
    if (url.pathname.endsWith('registry.js')) {
      event.respondWith(networkFirst(request, DATA_CACHE));
    } else {
      event.respondWith(cacheFirst(request, DATA_CACHE));
    }
    return;
  }

  // 4-1) 마크다운 원본 파일 → Cache First (exams/*.md 등, 정적 원본)
  if (MD_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 5) 코드 자산(CSS/JS) → Network First
  //    (온라인이면 항상 최신 배포본, 오프라인이면 캐시 폴백.
  //     버전 bump을 깜빡해도 폰에서 구버전이 남지 않도록 함)
  if (/\.(?:css|js)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // 6) 그 외 App Shell(아이콘/이미지 등) → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

/* ------------------------------------------------------------
 * 캐시 전략 구현
 * ---------------------------------------------------------- */

/** Network First: 네트워크 우선, 실패 시 캐시 폴리백 (HTML 문서용) */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

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
