# 🎧 오디오북 호스팅 및 청취 가이드

> **최종 업데이트**: 2026-08-27
> **목적**: 교재 리더 오디오북 기능의 아키텍처, 호스팅 방안, 모바일 청취 동작 체인을 설명

---

## 1. 개요

본 프로젝트는 교재 리더(`textbook-reader`)에서 각 과목 단원별 MP3 오디오북 재생을 지원합니다.

- **오디오 파일**: 19개 MP3, 총 **302.6MB**
- **위치**: `content/audiobook/mp3/{과목키}/{파일명}.mp3`
- **배포 제외**: `.vercelignore`에서 `*.mp3` + `content/audiobook/` 규칙으로 Vercel 배포에서 제외 (용량 초과 방지)

---

## 2. 아키텍처

### 2-1. 오디오 매니페스트 ([`data/audio_manifest.js`](../../data/audio_manifest.js))

```js
export const AUDIO_BASE_URL = null; // null = 로컬 개발 모드, 문자열 = 외부 CDN URL

export const AUDIO_MANIFEST = {
  "law": { "0": "content/audiobook/mp3/law/ch01_1_화장품법2026.mp3", ... },
  "manufacturing": { "0": "content/audiobook/mp3/manufacturing/...", ... },
  "safety": { "0": "content/audiobook/mp3/safety/...", ... },
  "understanding": { "0": "content/audiobook/mp3/understanding/...", ... }
};

export function getAudioUrl(localPath) {
  if (AUDIO_BASE_URL && AUDIO_BASE_URL.trim() !== '') {
    const fileName = localPath.split('/').pop();
    const subjDir = localPath.split('/').slice(-2, -1)[0];
    return `${AUDIO_BASE_URL.replace(/\/$/, '')}/${subjDir}/${fileName}`;
  }
  return localPath; // 로컬 개발 모드
}
```

- `AUDIO_BASE_URL`이 `null`이면 로컬 상대 경로(`content/audiobook/mp3/...`) 반환
- `AUDIO_BASE_URL`을 외부 CDN URL로 설정하면 `${BASE}/${과목키}/${파일명}.mp3` 형태로 변환

### 2-2. 오디오 경로 결정 ([`src/views/textbook-reader.js`](../../src/views/textbook-reader.js))

```
getAudioPathForChapter(subjId, chapter)
  ├─ 1) AUDIO_MANIFEST에서 단원 인덱스 기반 경로 조회
  ├─ 2) 매니페스트 미등록 시 챕터 제목에서 파일명 추론
  └─ 3) window.getAudioUrl(localPath)로 최종 URL 변환
       ├─ AUDIO_BASE_URL 설정 → 외부 CDN URL
       └─ AUDIO_BASE_URL = null → 로컬 상대 경로
```

### 2-3. Service Worker 처리 ([`sw.js`](../../sw.js))

```js
const BYPASS_PATTERNS = [
  /\.mp3$/i,
  /content\/audiobook\/mp3\//i
];
```

- MP3 요청은 **캐시 우회, 네트워크 직행** (302MB 캐싱 방지)
- cross-origin 요청(`url.origin !== self.location.origin`)도 SW가 간섭하지 않고 브라우저에 위임
- 즉, GitHub Releases 등 외부 URL의 MP3는 SW를 거치지 않고 브라우저가 직접 스트리밍

### 2-4. Media Session API 연동

`textbook-reader.js`의 `setupMediaSession()`이 다음을 지원:
- 백그라운드 재생 (모바일 화면 꺼짐 상태에서도 재생 지속)
- 잠금 화면 미디어 컨트롤 (재생/일시정지/이전/다음 트랙)
- 재생 속도 조절 (0.75x ~ 2.0x, `localStorage`에 저장)
- 이어보기 (단원 전환/화면 이동 시 재생 위치를 `localStorage`에 저장)

---

## 3. 호스팅 방안 비교

### 방안 A: GitHub Releases (권장)

| 항목 | 내용 |
|------|------|
| **비용** | 무료 |
| **용량 제한** | Release당 2GB, 단일 파일 2GB |
| **CSP 수정** | `media-src 'self' https://github.com https://*.githubusercontent.com` 필요 |
| **캐시** | GitHub CDN이 자동 캐싱 (Cache-Control: immutable) |
| **변경** | `AUDIO_BASE_URL`을 Releases URL로 설정만 하면 됨 |
| **단점** | GitHub raw URL이 301 redirect → 최종 도메인(`objects.githubusercontent.com`)도 CSP에 포함 필요 |

### 방안 B: 별도 Vercel 프로젝트 (오디오 전용)

| 항목 | 내용 |
|------|------|
| **비용** | Vercel Pro $20/월 (Hobby는 100MB 제한) |
| **용량 제한** | Pro: 1GB/배포 |
| **CSP 수정** | `media-src 'self' https://<audio-project>.vercel.app` |
| **단점** | 302MB > Hobby 100MB 제한 → Pro 요금제 필요 |

### 방안 C: Cloudflare R2

| 항목 | 내용 |
|------|------|
| **비용** | 무료 (10GB 저장, 이그레스 무료) |
| **용량 제한** | 10GB (302MB 여유) |
| **CSP 수정** | `media-src 'self' https://<bucket>.r2.dev` |
| **장점** | 글로벌 CDN, 이그레스 비용 없음 |
| **단점** | R2 계정 설정 필요 |

### 방안 D: Cloudflare Pages

| 항목 | 내용 |
|------|------|
| **비용** | 무료 |
| **용량 제한** | 25MB/파일, 500MB/배포 |
| **CSP 수정** | `media-src 'self' https://<project>.pages.dev` |
| **단점** | 단일 파일 25MB 초과 시 업로드 불가, 과목별 분할 배포 필요 |

---

## 4. 방안 A (GitHub Releases) 적용 절차

### 4-1. GitHub Release 생성

1. GitHub 리포지토리 → Releases → Draft a new release
2. Tag: `audio-v1` (고정 태그, `AUDIO_BASE_URL`에 사용)
3. 19개 MP3를 과목별 디렉토리 구조로 업로드:
   ```
   law/ch01_1_화장품법2026.mp3
   law/ch02_2_개인정보_보호법2026.mp3
   manufacturing/ch01_1_화장품_원료의_종류와_특성_및_제품의_제조관리2026.mp3
   ...
   understanding/ch07_7_충진_및_포장2026.mp3
   ```
4. Publish release

### 4-2. `data/audio_manifest.js` 수정

```js
export const AUDIO_BASE_URL = 'https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audio-v1';
```

- `getAudioUrl()`이 `${AUDIO_BASE_URL}/${subjDir}/${fileName}` 형태로 조합
- 예: `https://github.com/.../releases/download/audio-v1/law/ch01_1_화장품법2026.mp3`

### 4-3. `vercel.json` CSP 수정

```
default-src 'self'; ... media-src 'self' https://github.com https://*.githubusercontent.com; ...
```

- `https://github.com` — Release 다운로드 URL (301 redirect 출처)
- `https://*.githubusercontent.com` — 최종 MP3 파일이 서빙되는 도메인
- 현재 CSP에 `media-src`가 없어 `default-src 'self'`가 적용되어 외부 오디오가 **차단됨**

### 4-4. `.vercelignore` 유지

```
*.mp3
content/audiobook/
```

- MP3는 Vercel에 업로드하지 않음 (GitHub Releases에서 호스팅)

---

## 5. 모바일 청취 동작 체인

```
사용자가 교재 리더에서 ▶ 재생 버튼 탭
  │
  ├─ data-click="toggleReaderAudio" → window.toggleReaderAudio()
  │
  ├─ getAudioPathForChapter(subjId, chapter)
  │    ├─ AUDIO_MANIFEST에서 단원 경로 조회
  │    └─ window.getAudioUrl(localPath)
  │         └─ AUDIO_BASE_URL 설정 → GitHub Releases URL 반환
  │
  ├─ <audio src="https://github.com/.../releases/download/audio-v1/law/ch01_1_...mp3">
  │    └─ 브라우저가 301 redirect → objects.githubusercontent.com에서 MP3 스트리밍
  │
  ├─ Service Worker: .mp3 패턴 감지 → 캐시 우회, 네트워크 직행 (SW 간섭 없음)
  │
  ├─ Media Session API: 잠금 화면 컨트롤, 백그라운드 재생 활성화
  │
  └─ 이어보기: 재생 위치를 localStorage에 저장 (단원 전환/화면 이동 시)
```

### 모바일 특이사항

- **iOS Safari**: `<audio>` + Media Session API로 백그라운드 재생, 잠금 화면 컨트롤 지원
- **Android Chrome**: PWA 설치 시 독립 플레이어처럼 동작
- **오프라인**: 오디오는 SW가 캐시하지 않으므로 **오프라인 청취 불가** (의도된 설계 — 302MB 캐싱 방지)
- **데이터 사용량**: MP3 스트리밍이므로 모바일 데이터 소비 발생

---

## 6. 로컬 개발 모드

`AUDIO_BASE_URL = null`일 때:
- `getAudioUrl()`이 로컬 상대 경로(`content/audiobook/mp3/...`)를 그대로 반환
- `serve.js` 개발 서버(`npm run serve`) 또는 `file://` 직접 열기로 로컬 MP3 재생
- Service Worker는 `.mp3` 패턴을 bypass하므로 로컬에서도 SW 간섭 없이 재생

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| [`data/audio_manifest.js`](../../data/audio_manifest.js) | 오디오 매니페스트 (과목→단원→MP3 경로 매핑, `getAudioUrl()`) |
| [`src/views/textbook-reader.js`](../../src/views/textbook-reader.js) | 오디오 플레이어 UI, 재생/일시정지/이동/속도/이어보기, Media Session API |
| [`sw.js`](../../sw.js) | MP3 캐시 우회 (BYPASS_PATTERNS), cross-origin 직행 |
| [`vercel.json`](../../vercel.json) | CSP 헤더 (`media-src` 설정 필요) |
| [`.vercelignore`](../../.vercelignore) | MP3 배포 제외 규칙 |
| [`content/audiobook/`](../../content/audiobook/) | MP3 원본 파일 + Python TTS 파이프라인 |
