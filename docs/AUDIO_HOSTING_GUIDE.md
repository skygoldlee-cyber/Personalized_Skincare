# 🎧 모바일 오디오 호스팅 가이드 (GitHub Releases)

> **대상 프로젝트**: 맞춤형화장품 조제관리사 스마트 학습 플랫폼
> **작성일**: 2026-08-21
> **목적**: Vercel 배포본(프로덕션)에서 교재 오디오(MP3)를 재생할 수 있도록 외부 호스팅 구성

---

## 📌 배경

| 항목 | 내용 |
|---|---|
| 오디오 파일 | 19개 챕터 MP3, 총 **302MB** (최대 49.9MB/파일) |
| 문제 | Vercel Hobby 플랜 배포 한도 **100MB** → MP3를 함께 배포 불가 |
| 현재 상태 | `data/audio_manifest.js`의 `AUDIO_BASE_URL = null` → 로컬 경로 모드라 프로덕션에서 404 |
| 해결 | **GitHub Releases**에 MP3 업로드 후 CDN URL 연결 |

### 왜 GitHub Releases인가?

| 기준 | GitHub Releases ✅ | Cloudflare R2 | 별도 Vercel 프로젝트 |
|---|---|---|---|
| 비용 | 물료 | 물료(10GB) | 물료(Hobby) |
| 파일 크기 제한 | 2GB/파일 | 무제한 | 배포 합계 100MB (→ 4개 프로젝트 분할 필요) |
| 대역폭 | 사실상 무제한 | egress 물료 | 100GB/월 |
| 설정 난이도 | 낮음 (기존 GitHub 계정) | 중간 (버킷/CORS/키) | 낮으나 관리 포인트 4개 |
| URL 안정성 | 영구 (태그 기반) | 영구 | alias 고정 가능 |
| Range 요청(시크/이어보기) | ✅ 지원 | ✅ 지원 | ✅ 지원 |

---

## ✅ 사전 점검

1. **MP3 원본 위치 확인**: 19개 파일이 한 폴터(또는 `content/audiobook/mp3/{과목}/` 구조)에 준비되어 있어야 합니다.
2. **파일명 충돌 없음 확인됨**: 현재 매니페스트 기준 19개 파일명이 모두 고유합니다 (예: `ch01_1_화장품법2026.mp3`, `ch01_1_작업장_위생관리2026.mp3` — 제목이 달라 충돌 없음). Releases는 폴터 구조를 보존하지 않고 **파일명만**으로 접근하므로 이 조건이 필수입니다.
3. **GitHub CLI 설치** (권장): https://cli.github.com/ — 설치 후 `gh auth login` 완료.

---

## 🚀 1단계: GitHub Release 생성 및 MP3 업로드

### 방법 A: GitHub CLI (권장, 한 번에 업로드)

```powershell
# 프로젝트 루트에서 실행 (MP3가 content/audiobook/mp3/{과목}/ 구조에 있다고 가정)
cd c:/Project/Personalized_Skincare

# 1) 릴리스 생성 + 전체 MP3 업로드 (태그: audiobook-v1)
gh release create audiobook-v1 `
  --repo skygoldlee-cyber/Personalized_Skincare `
  --title "Audiobook v1" `
  --notes "교재 오디오 MP3 19개 (총 302MB, 64kbps). 앱의 data/audio_manifest.js에서 참조." `
  content/audiobook/mp3/law/*.mp3 `
  content/audiobook/mp3/manufacturing/*.mp3 `
  content/audiobook/mp3/safety/*.mp3 `
  content/audiobook/mp3/understanding/*.mp3
```

> ⚠️ 각 과목 폴터에 `ch{NN}_chunks/` 서브폴터가 있으면 그 안의 청크 MP3는 **제외**하고, 최종 병합본(과목 폴터 바로 아래의 파일)만 업로드하세요. 위 명령은 `*.mp3`를 폴터 최상위만 매칭하므로 청크는 자동 제외됩니다 (PowerShell `*`는 재귀하지 않음).

### 방법 B: 웹 UI (수동)

1. https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/new 접속
2. **Choose a tag** → `audiobook-v1` 입력 → **Create new tag** 클릭
3. Release title: `Audiobook v1`
4. **Attach binaries** 영역에 MP3 19개를 드래그 앤 드롭 (여러 번 나눠 업로드 가능)
5. **Publish release** 클릭

### 업로드 확인

```powershell
gh release view audiobook-v1 --repo skygoldlee-cyber/Personalized_Skincare
```

에셋 19개가 보이면 성공. 각 파일의 다운로드 URL 형식:

```
https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audiobook-v1/ch01_1_화장품법2026.mp3
```

---

## 🔧 2단계: 코드 수정 (2개 파일)

### 2-1. `data/audio_manifest.js` — `AUDIO_BASE_URL` 설정

**14행 변경:**
```js
// 변경 전
const AUDIO_BASE_URL = null; // null = 로컬 개발 모드, 문자열 = 외부 CDN URL

// 변경 후
const AUDIO_BASE_URL = 'https://github.com/skygoldlee-cyber/Personalized_Skincare/releases/download/audiobook-v1';
```

### 2-2. `data/audio_manifest.js` — `getAudioUrl()` 경로 조합 수정

Releases는 폴터 구조가 없으므로 **과목 디렉터리(`subjDir`)를 제거**하고 파일명만 조합합니다.

**56~58행 변경:**
```js
// 변경 전
    const fileName = localPath.split('/').pop();
    const subjDir = localPath.split('/').slice(-2, -1)[0]; // law, manufacturing 등
    return `${AUDIO_BASE_URL.replace(/\/$/, '')}/${subjDir}/${fileName}`;

// 변경 후
    const fileName = localPath.split('/').pop();
    return `${AUDIO_BASE_URL.replace(/\/$/, '')}/${fileName}`;
```

> 💡 로컬 개발 모드에서는? 로컬에서 `content/audiobook/mp3/` 파일이 그대로 있다면, 개발 시에만 `AUDIO_BASE_URL = null`로 바꿔 테스트하고 커밋 전에 되돌리거나, 로컬에서도 Releases URL을 그대로 사용(인터넷 필요)하면 됩니다. **권장**: Releases URL을 커밋하고, 로컬 오프라인 개발이 필요할 때만 임시로 `null`로 변경.

### 2-3. (권장) 모바일 백그라운드 재생 — Media Session API

현재 `src/app.js`의 `visibilitychange` 핸들러(4222행 부근)는 탭이 숨겨지면 오디오를 **강제 일시정지**합니다. 모바일에서 화면을 끄고 듣기(잠금화면 컨트롤)를 원하면 아래처럼 개선하세요.

**A. 강제 일시정지 제거** (`src/app.js` 4222~4231행):
```js
// 변경 전
document.addEventListener('visibilitychange', () => {
    const a = readerAudioState.audio;
    if (!a) return;
    if (document.hidden) {
        readerAudioState.wasPlayingBeforeHidden = !a.paused;
        if (!a.paused) { a.pause(); }
    }
    // 복귀 시 자동 재개는 하지 않음(사용자 제스처 필요 정책 회피). 아이콘만 갱신.
    if (!document.hidden) { updatePlayPauseIcon(); }
});

// 변경 후: 숨겨져도 계속 재생 (Media Session으로 잠금화면 제어)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { updatePlayPauseIcon(); }
});
```

**B. Media Session 메타데이터 설정** — `toggleReaderAudio()` 함수에서 `audio.play()` 호출 직전(4207행 부근)에 추가:
```js
    // 잠금화면/알림 영역에 표시될 메타데이터
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: chapter.chapterTitle,
            artist: '맞춤형화장품 조제관리사 오디오북',
            album: subj.subjectTitle || subj.title || '',
            artwork: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
        navigator.mediaSession.setActionHandler('play', () => audio.play());
        navigator.mediaSession.setActionHandler('pause', () => audio.pause());
        // 15초 앞/뒤 탐색 (잠금화면 버튼)
        navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
        navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15); });
    }
```

**C. `stopReaderAudio()`에서 세션 정리** (4077행 부근, 함수 끝에 추가):
```js
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
    }
```

> ⚠️ 주의: iOS Safari는 PWA(standalone) 모드가 아닌 일반 탭에서는 화면 꺼짐 시 재생이 멈출 수 있습니다. **PWA로 설치하면 백그라운드 재생이 훨씬 안정적**입니다. 사용자 매뉴얼에 "오디오 학습은 홈 화면에 설치 후 사용 권장" 안내를 추가하는 것을 권장합니다.

---

## 🧪 3단계: 검증

```powershell
# 1) 문법 검사
node --check src/app.js
node --check data/audio_manifest.js

# 2) 로컬 서버로 확인
node serve.js
# 브라우저에서 http://localhost:포트 접속 → 교재 읽기 → "오디오 듣기" 클릭
# 개발자도구 Network 탭에서 github.com/.../releases/download/... 로 요청되는지 확인
```

**모바일 체크리스트:**
- [ ] 프로덕션 URL에서 오디오 재생 시작
- [ ] 시크바 드래그 → 원하는 위치로 이동 (Range 요청 동작)
- [ ] 절반 듣고 앱 종료 → 재방문 시 "이어듣기" 위치 복원
- [ ] (Media Session 적용 시) 화면 끄기 → 계속 재생 + 잠금화면 컨트롤 표시
- [ ] 재생 속도 버튼(1x → 1.25x ...) 동작

---

## 🚢 4단계: 배포

```powershell
git add data/audio_manifest.js src/app.js
git commit -m "feat: 오디오 GitHub Releases 호스팅 연결 + 모바일 백그라운드 재생(Media Session)"
git push origin main
npx vercel --prod --yes
```

---

## 💾 대역폭/비용 참고

- 19개 전체 스트리밍 1회 = 약 302MB. GitHub Releases 대역폭은 소프트 제한(사실상 개인 학습용으로 문제없음).
- 사용자가 늘어나 트래픽이 커지면 **Cloudflare R2**(egress 물료)로 마이그레이션 권장 — `AUDIO_BASE_URL`만 R2 공개 URL로 바꾸면 됨 (R2는 폴터 구조 지원하므로 `getAudioUrl()`의 `subjDir` 조합을 되돌리면 됨).

## 🔁 MP3 재생성 후 재업로드

```powershell
# 기존 릴리스에 에셋만 교체 (동일 파일명은 덮어쓰기)
gh release upload audiobook-v1 content/audiobook/mp3/law/*.mp3 --clobber --repo skygoldlee-cyber/Personalized_Skincare
# ... 나머지 과목도 동일하게
```
