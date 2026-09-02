# 🎧 오디오북 호스팅 및 청취 가이드

> **최종 업데이트**: 2026-09-03
> **목적**: 교재 리더 오디오북 기능의 아키텍처, 호스팅 방안, 모바일 청취 동작 체인, 청크 동기화 구현 계획을 설명

---

## 1. 개요

본 프로젝트는 교재 리더(`textbook-reader`)에서 각 과목 단원별 MP3 오디오북 재생을 지원합니다.

### 1-1. 이야기형 교재 오디오 (2026-09-03 생성)

- **오디오 파일**: 4개 병합 MP3 + 292개 청크 MP3, 총 **~854MB**
- **TTS 엔진**: Google Translate TTS 직접 호출 (`tts_google_direct.py`)
- **위치**: `content/audiobook/mp3/{과목키}/`
  - 병합: `ch##_과목명_이야기형.mp3`
  - 청크: `ch##_chunks/ch##_###.mp3` (청크당 2-4MB)
- **배포 제외**: `.vercelignore`에서 `*.mp3` + `content/audiobook/` 규칙으로 Vercel 배포에서 제외 (용량 초과 방지)

| 과목 | 청크 수 | 병합 MP3 크기 |
|------|---------|-------------|
| 1과목 (law) | 54개 | 160,912 KB |
| 2과목 (manufacturing) | 106개 | 299,537 KB |
| 3과목 (safety) | 63개 | 195,446 KB |
| 4과목 (understanding) | 69개 | 198,538 KB |
| **합계** | **292개** | **~854 MB** |

### 1-2. 기존 일반형 교재 오디오 (구 방식)

- **오디오 파일**: 19개 MP3, 총 **302.6MB** (단원별 분할)
- **위치**: `content/audiobook/mp3/{과목키}/{파일명}.mp3`

---

## 2. 아키텍처

### 2-1. 오디오 매니페스트 ([`data/audio_manifest.js`](../../data/audio_manifest.js))

```js
export const AUDIO_BASE_URL = null; // null = 로컬 개발 모드, 문자열 = 외부 CDN URL

export const AUDIO_MANIFEST = {
  "law": { "0": "content/audiobook/mp3/law/ch01_1과목_화장품법의이해_이야기형.mp3" },
  "manufacturing": { "0": "content/audiobook/mp3/manufacturing/ch02_2과목_제조및품질관리_이야기형.mp3" },
  "safety": { "0": "content/audiobook/mp3/safety/ch03_3과목_유통화장품안전관리_이야기형.mp3" },
  "understanding": { "0": "content/audiobook/mp3/understanding/ch04_4과목_맞춤형화장품의이해_이야기형.mp3" }
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
- 현재 매니페스트는 이야기형 교재 4개 과목만 등록되어 있음

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

> **중요**: 병합 MP3(854MB)와 청크 MP3(854MB)의 총 용량은 동일하므로, Vercel 배포는 불가능 (Hobby 100MB 제한). 외부 CDN 필수.

### 방안 A: GitHub Releases (권장)

| 항목 | 내용 |
|------|------|
| **비용** | 무료 |
| **용량 제한** | Release당 2GB, 단일 파일 2GB (우리 청크는 최대 4MB) |
| **CSP 수정** | `media-src 'self' https://github.com https://*.githubusercontent.com` 필요 |
| **캐시** | GitHub CDN이 자동 캐싱 (Cache-Control: immutable) |
| **변경** | `AUDIO_BASE_URL`을 Releases URL로 설정만 하면 됨 |
| **단점** | GitHub raw URL이 301 redirect → 최종 도메인(`objects.githubusercontent.com`)도 CSP에 포함 필요 |
| **전제** | repo가 **public**이어야 브라우저에서 직접 재생 가능 (private면 인증 필요) |
| **청크 장점** | 292개 파일을 평탄화하여 업로드, 청크 단위 캐싱으로 모바일 데이터 절약 |

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

1. GitHub 리포지토리 → Releases → Draft a new release (또는 `gh release create`)
2. Tag: `audio-v1` (고정 태그, `AUDIO_BASE_URL`에 사용)
3. 292개 청크 MP3를 평탄화하여 업로드 (디렉토리 구조 불가하므로 과목 접두사 사용):
   ```
   law_ch01_001.mp3
   law_ch01_002.mp3
   ...
   manufacturing_ch02_001.mp3
   ...
   safety_ch03_001.mp3
   ...
   understanding_ch04_001.mp3
   ...
   ```
4. Publish release

**CLI 일괄 업로드 예시:**
```bash
# 청크 파일들을 평탄화하여 Release에 업로드
gh release create audio-v1 --title "오디오북 청크 v1" --notes "이야기형 교재 TTS 청크 292개"
# 파일명 평탄화 후 업로드 (스크립트 권장)
gh release upload audio-v1 flattened_chunks/*.mp3
```

### 4-2. `data/audio_manifest.js` 수정

```js
export const AUDIO_BASE_URL = 'https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audio-v1';
```

- `getAudioUrl()`이 `${AUDIO_BASE_URL}/${subjDir}/${fileName}` 형태로 조합
- 예: `https://github.com/.../releases/download/audio-v1/law/ch01_001.mp3`

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

### 5-1. 현재 (병합 MP3 방식)

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

### 5-2. 계획: 순차 청크 재생 방식

```
사용자가 교재 리더에서 ▶ 재생 버튼 탭
  │
  ├─ chunk_manifest.js에서 해당 과목의 청크 목록 로드 (수 KB)
  │
  ├─ 청크 1번 MP3 (2-4MB)만 fetch하여 재생
  │    └─ GitHub Releases URL → 브라우저 301 redirect → CDN 스트리밍
  │
  ├─ 현재 청크의 sectionTitle로 본문 하이라이트 + 자동 스크롤
  │
  ├─ 재생 중 다음 청크 preload (Audio 객체 미리 생성)
  │
  ├─ 청크 1번 재생 완료 → 청크 2번 자동 전환 (끊김 최소화)
  │
  ├─ Service Worker: .mp3 패턴 감지 → 캐시 우회, 네트워크 직행
  │
  ├─ Media Session API: 잠금 화면 컨트롤, 백그라운드 재생 활성화
  │
  └─ 이어보기: 청크 인덱스 + 청크 내 재생 위치를 localStorage에 저장
```

### 모바일 특이사항

- **iOS Safari**: `<audio>` + Media Session API로 백그라운드 재생, 잠금 화면 컨트롤 지원
- **Android Chrome**: PWA 설치 시 독립 플레이어처럼 동작
- **오프라인**: 오디오는 SW가 캐시하지 않으므로 **오프라인 청취 불가** (의도된 설계 — 대용량 캐싱 방지)
- **데이터 사용량 (병합 방식)**: 과목당 160-300MB 전체 스트리밍 → 모바일 데이터 부담 큼
- **데이터 사용량 (청크 방식)**: 청크당 2-4MB, 들은 부분만 다운로드 → **데이터 절약**
- **초기 버퍼링 (병합 방식)**: 160-300MB 파일 → 수십 초 대기
- **초기 버퍼링 (청크 방식)**: 2-4MB 파일 → **1-2초 내 재생 시작**

---

## 6. 로컬 개발 모드

`AUDIO_BASE_URL = null`일 때:
- `getAudioUrl()`이 로컬 상대 경로(`content/audiobook/mp3/...`)를 그대로 반환
- `serve.js` 개발 서버(`npm run serve`) 또는 `file://` 직접 열기로 로컬 MP3 재생
- Service Worker는 `.mp3` 패턴을 bypass하므로 로컬에서도 SW 간섭 없이 재생

---

## 7. 청크 동기화 구현 로드맵

### 7-1. 방식 비교

| 방식 | 재생 품질 | 정확도 | 모바일 데이터 | 파일 크기 | 채택 |
|------|----------|--------|-------------|----------|------|
| 병합 MP3 + 타임스탬프 | 끊김 없음 | 우수 (실제 duration) | 부담 큼 (160-300MB) | 160-300MB | |
| **순차 청크 재생** | 미세 끊김 (preload로 최소화) | 100% 정확 | **절약 (2-4MB씩)** | 2-4MB | **채택** |
| 하이브리드 | 끊김 없음 | 우수 | 부담 큼 | 160-300MB | |

**결정: 순차 청크 재생 + preload 최적화** — 모바일이 주요 사용 환경이므로 청크 단위 재생이 가장 현실적.

### 7-2. 구현 4단계

| 단계 | 작업 | 파일 |
|------|------|------|
| **1. 빌드** | `generate_all_mp3.py`에 `chunk_manifest.js` 자동 생성 추가 | `content/audiobook/generate_all_mp3.py` |
| **2. 업로드** | `gh release create audio-v1` + 청크 파일 일괄 업로드 스크립트 | 신규 `content/audiobook/upload_to_github.sh` |
| **3. 설정** | `AUDIO_BASE_URL`을 GitHub Releases URL로 변경 | `data/audio_manifest.js` |
| **4. 런타임** | 순차 청크 재생 + preload + 섹션 동기화 구현 | `src/views/textbook-reader.js` |

### 7-3. Phase 1: 빌드 타임 — 청크 메타데이터 생성

`generate_all_mp3.py` 실행 시 청크 정보를 JS로 출력:

```json
// chunk_manifest.js 예시
{
  "law": {
    "0": {
      "mergedFile": "ch01_1과목_화장품법의이해_이야기형.mp3",
      "chunks": [
        {
          "id": "ch01_001",
          "sectionTitle": "화장품법의 목적",
          "seq": 1,
          "charCount": 1691,
          "file": "ch01_chunks/ch01_001.mp3"
        },
        {
          "id": "ch01_002",
          "sectionTitle": "화장품법의 목적",
          "seq": 2,
          "charCount": 255,
          "file": "ch01_chunks/ch01_002.mp3"
        }
      ]
    }
  }
}
```

각 청크의 `sectionTitle`은 `md_chunker.py`의 `Chunk.section_title`에서 이미 추출됨 (`content/audiobook/md_chunker.py:168-170`).

### 7-4. Phase 2: 런타임 — 순차 청크 재생

핵심 변경 사항:

1. **`computeSectionBoundaries()` 교체**: 추정 로직 → 청크 메타데이터 기반 (`src/views/textbook-reader.js:220-231`)
2. **`toggleReaderAudio()` 변경**: 전체 MP3 로드 → 청크 1번 로드 + 순차 재생 (`src/views/textbook-reader.js:409-541`)
3. **`syncScrollWithAudio()` 변경**: 현재 청크의 `sectionTitle`로 섹션 하이라이트 (`src/views/textbook-reader.js:268-274`)
4. **preload 로직 추가**: 현재 청크 재생 중 다음 청크 `Audio` 객체 미리 생성
5. **섹션 클릭 시 해당 청크로 점프**: TOC 클릭 → 청크 인덱스 계산 → 해당 청크 재생

### 7-5. 기존 기능 유지

- 이어보기 (localStorage 위치 저장 — 청크 인덱스 + 청크 내 위치로 확장)
- 재생 속도 조절 (0.75x ~ 2x)
- Media Session API (잠금화면 제어)
- 자동 스크롤 토글
- 모바일 탭 숨김 시 자동 일시정지

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| [`data/audio_manifest.js`](../../data/audio_manifest.js) | 오디오 매니페스트 (과목→단원→MP3 경로 매핑, `getAudioUrl()`) |
| [`src/views/textbook-reader.js`](../../src/views/textbook-reader.js) | 오디오 플레이어 UI, 재생/일시정지/이동/속도/이어보기, Media Session API (1509줄) |
| [`sw.js`](../../sw.js) | MP3 캐시 우회 (BYPASS_PATTERNS), cross-origin 직행 |
| [`vercel.json`](../../vercel.json) | CSP 헤더 (`media-src` 설정 필요) |
| [`.vercelignore`](../../.vercelignore) | MP3 배포 제외 규칙 |
| [`content/audiobook/`](../../content/audiobook/) | MP3 원본 파일 + Python TTS 파이프라인 |
| [`content/audiobook/generate_all_mp3.py`](../../content/audiobook/generate_all_mp3.py) | TTS 배치 생성 스크립트 (chunk_manifest.js 생성 추가 예정) |
| [`content/audiobook/md_chunker.py`](../../content/audiobook/md_chunker.py) | MD 청킹 모듈 (Chunk.section_title 포함) |
| [`content/audiobook/mp3_merger.py`](../../content/audiobook/mp3_merger.py) | 청크 MP3 병합 모듈 |
| [`content/audiobook/tts_google_direct.py`](../../content/audiobook/tts_google_direct.py) | Google Translate TTS 직접 호출 엔진 |
