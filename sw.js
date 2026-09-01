/* ============================================================
 * Cosmetic Pass — Service Worker
 * 맞춤형화장품 조제관리사 스마트 학습 플랫폼 PWA
 *
 * 캐시 전략:
 *  - Navigation (HTML)             : Cache First (캐시 스큐 방지)
 *  - /src/*.js + CSS               : Cache First (ESM 그래프 + CSS 세대 일관성)
 *  - 그 외 JS                       : Network First (구버전 잔류 방지)
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

const CACHE_VERSION = 'v116-20260901-dashboard-improve';   // 대시보드 과목카드 강화, streak localStorage 안전화, 빈상태 CTA, 뽀모도로 자동정지
const DATA_CACHE_VERSION = 'v1';           // 데이터: 안정(해시 파일명이 변경 감지 담당) — 캐시 포맷이 바뀔 때만 수동 증가
const SHELL_CACHE = `cosmetic-pass-shell-${CACHE_VERSION}`;
const DATA_CACHE = `cosmetic-pass-data-${DATA_CACHE_VERSION}`;
const CDN_CACHE = `cosmetic-pass-cdn-${CACHE_VERSION}`;

/** 설치 시 미리 캐시할 App Shell 목록 */
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './css/base.css',
  './css/dashboard.css',
  './css/study.css',
  './css/exam.css',
  './css/trainer.css',
  './css/reader.css',
  './manifest.webmanifest',
  './ping.txt',
  './src/theme-init.js',
  './src/pwa-install-capture.js',
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
  './src/app-fallback.js',
  './src/ui-utils.js',
  // data/registry.js, data/audio_manifest.js: 이전 app.js ESM import 그래프에 포함되었으나
  // window 전역 참조 방식으로 변경되어 별도 프리캐시 필요 (오프라인 최초 실행 대비)
  './data/registry.js',
  './data/audio_manifest.js',
  './src/views/dashboard.js',
  './src/views/flashcard.js',
  './src/views/quiz.js',
  './src/views/trainer.js',
  './src/views/dictionary.js',
  './src/views/backup.js',
  './src/views/textbook-search.js',
  './src/views/textbook-reader.js',
  './src/views/exam-simulator.js',
  './src/views/navigation.js',
  './src/html-viewer.js',
  './src/pdf-registry.js',
  './src/reader-format.js',
  './src/concept-map.js',
  './src/study-aids.js',
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
  // Mermaid(3.3MB) — 매뉴얼/교재 리더의 다이어그램 렌더링에 필요.
  //   온디맨드 로드이지만 PWA 오프라인 환경에서도 다이어그램이 표시되도록 프리캐시에 포함.
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

/** 설치 시 프리캐시할 마크다운 문서 (매뉴얼·요약집 — 오프라인 보장) */
const MD_ASSETS = [
  './docs/user/user_manual.md',
  './content/학습안내서.md',
  './content/교재/law/1과목_화장품법의이해.md',
  './content/교재/manufacturing/2과목_제조및품질관리.md',
  './content/교재/safety/3과목_유통화장품안전관리.md',
  './content/교재/understanding/4과목_맞춤형화장품의이해.md',
  './content/문제은행/과목1_문제은행_교재인용.md',
  './content/문제은행/과목2_문제은행_교재인용.md',
  './content/문제은행/과목3_문제은행_교재인용.md',
  './content/문제은행/과목4_문제은행_교재인용.md'
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
/**
 * addAll 의 원자성(all-or-nothing)을 버리고 자산을 개별 캐싱한다.
 * addAll 은 목록 중 하나만 404 여도 전체가 reject 되는데, 그러면 install 의
 * skipWaiting() 이 실행되지 않아 새 SW 가 영영 활성화되지 못한다. navigation 이
 * cacheFirst 인 구조에서는 그 결과 사용자가 구버전 셸에 '자동 갱신 없이' 갇힌다
 * (networkFirst 였을 때보다 오히려 나쁜 실패 모드).
 * 개별 add 를 allSettled 로 처리하면 일부가 실패해도 새 세대는 반드시 활성화되고,
 * 실패분은 cacheFirst 의 네트워크 폴백으로 온디맨드 자가 치유된다(온라인 한정).
 * @returns {Promise<string[]>} 실패한 자산 목록
 */
async function precacheResilient(cacheName, assets) {
  const cache = await caches.open(cacheName);
  const results = await Promise.allSettled(
    assets.map((asset) => cache.add(asset))
  );
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') failed.push(assets[i]);
  });
  if (failed.length) {
    console.warn(
      `[SW] 프리캐시 일부 실패 (${failed.length}/${assets.length}) — ` +
        '새 SW 는 정상 활성화됨, 실패분은 온디맨드 캐싱으로 폴백:',
      failed
    );
  }
  return failed;
}

self.addEventListener('install', (event) => {
  // 프리캐시는 관용적(resilient)으로 수행한다 — 이유는 precacheResilient 주석 참고.
  // 개별 실패를 허용하되 skipWaiting 은 절대 건너뛰지 않아 업데이트 경로가 브릭되지 않는다.
  event.waitUntil(
    Promise.all([
      precacheResilient(SHELL_CACHE, SHELL_ASSETS),
      precacheResilient(DATA_CACHE, DATA_ASSETS),
      precacheResilient(SHELL_CACHE, MD_ASSETS)
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

  // 3-1) 페이지 네비게이션(HTML 문서) → Cache First (캐시 스큐 방지)
  // HTML을 Network First로 서빙하면, 구 SW가 신버전 HTML(네트워크) + 구버전 JS(캐시)를
  // 섞어서 반환하여 ESM import 그래프가 붕괴하는 캐시 스큐가 발생한다.
  // Cache First로 변경하면 HTML과 JS가 항상 동일한 CACHE_VERSION 캐시에서 서빙되어
  // 세대 내 불일치가 원천 차단된다. 새 SW install + skipWaiting + controllerchange 리로드 후
  // 신버전 캐시로 일괄 전환되므로 업데이트 지연은 최대 1 page load 분량이다.
  if (request.mode === 'navigate') {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
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

  // 4-1) 마크다운 원본 파일 → Cache First (content/exams/*.md 등, 정적 원본)
  if (MD_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 5-1) /src/ 하위 JS 모듈 → Cache First (캐시 스큐 방지)
  //      ESM import 그래프는 한 모듈이라도 버전이 어긋나면 전체가 드랍됨.
  //      networkFirst를 쓰면 모바일 불안정 네트워크에서 일부는 신버전(네트워크),
  //      일부는 구버전(캐시)이 섞여 import { 새이름 }이 구파일에 없어 그래프가 붕괴.
  //      cacheFirst + SHELL_ASSETS 프리캐시로 동일 버전 파일만 일관 서빙.
  //      새 SW install 시 새 CACHE_VERSION 캐시에 전체 셸을 원자적으로 프리캐시 → 세대 내 불일치 불가.
  if (url.pathname.includes('/src/') && /\.js$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 5-2) CSS → Cache First (캐시 스큐 방지 — /src/ JS와 동일 사유)
  //      배포 전환 순간 "구버전 HTML(cacheFirst) + 신버전 CSS(networkFirst)" 혼합으로
  //      화면 깨짐 방지. SHELL_ASSETS 프리캐시로 동일 버전만 서빙.
  if (/\.css$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 5-3) 그 외 JS → Network First
  //      (온라인이면 항상 최신 배포본, 오프라인이면 캐시 폴백.
  //       버전 bump을 깜빡해도 폰에서 구버전이 남지 않도록 함)
  if (/\.js$/i.test(url.pathname)) {
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
