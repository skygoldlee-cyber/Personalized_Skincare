# 📚 문서 인덱스 (Documentation Index)

> **Cosmetic Pass Master** — 맞춤형화장품 조제관리사 스마트 학습 플랫폼

---

## 📂 문서 구조

```
docs/
├── README.md                  ← 본 파일 (문서 인덱스)
├── dev/                       ← 개발 문서
│   ├── ARCHITECTURE.md        ← 아키텍처 및 설계 철학
│   ├── AUDIO_HOSTING_GUIDE.md ← 오디오북 호스팅 및 청취 가이드
│   ├── DEPLOYMENT_GUIDE.md    ← Vercel 배포 및 호스팅 가이드
│   ├── MULTI_MACHINE_SETUP.md ← 다중 머신 개발 환경 설정
│   ├── PROJECT_MINDMAP.md     ← 프로젝트 전체 구조 마인드맵
│   ├── CHANGES.md             ← 코드 리뷰 수정 내역
│   └── IMPROVEMENTS_REPORT.md ← 보완 및 개선점 정리 보고서
└── user/                      ← 사용자 문서
    └── user_manual.md         ← 사용자 매뉴얼 (앱 내 매뉴얼 뷰어 연동)
```

> `content/학습안내서.md` (학습 안내서)는 교재 콘텐츠이므로 `content/` 폴더에 있습니다.

---

## 🔧 개발 문서 (docs/dev/)

| 문서 | 설명 | 주요 내용 |
|------|------|-----------|
| [ARCHITECTURE.md](dev/ARCHITECTURE.md) | 시스템 아키텍처 및 설계 철학 | Zero-Backend, ESM 모듈 구조, 데이터 흐름, PWA/SW 전략, 테마 시스템 |
| [AUDIO_HOSTING_GUIDE.md](dev/AUDIO_HOSTING_GUIDE.md) | 오디오북 호스팅 및 청취 가이드 | 아키텍처, 호스팅 방안 비교, GitHub Releases 적용 절차, 모바일 청취 동작 체인 |
| [DEPLOYMENT_GUIDE.md](dev/DEPLOYMENT_GUIDE.md) | Vercel 배포 및 오디오 호스팅 | 용량 최적화, .vercelignore, CSP/캐시 정책, 배포 체크리스트, 트러블슈팅 |
| [MULTI_MACHINE_SETUP.md](dev/MULTI_MACHINE_SETUP.md) | 다중 머신 개발 환경 설정 | GitHub SSH, Vercel CLI 인증, GitHub Actions 자동 배포 |
| [PROJECT_MINDMAP.md](dev/PROJECT_MINDMAP.md) | 프로젝트 전체 구조 시각화 | Mermaid 마인드맵 — 설계 철학, 기능, 기술 스택, 데이터 파이프라인 |
| [DEPLOY.md](dev/DEPLOY.md) | Git Push & Vercel 배포 절차 | 빌드 → 커밋/푸시 → 배포 파이프라인, 명령어별 실행 범위 |
| [TEXTBOOK_AUTHORING_GUIDE.md](dev/TEXTBOOK_AUTHORING_GUIDE.md) | 교재 Markdown 작성 지침 | 디렉토리 구조, manifest.json, 카드/퀴즈 추출 규칙, 문제은행 형식, 빌드 검증 |
| [CHANGES.md](dev/CHANGES.md) | 코드 변경 이력 (Changelog) | #42 기출문제 링크 클릭 시 문제집 HTML 뷰어 연동, #41 이야기형 교재 5가지 서사 개선+외부 리뷰, #27 매뉴얼 재정리, #26 교재 5대 학습 보조 개선 |
| [IMPROVEMENTS_REPORT.md](dev/IMPROVEMENTS_REPORT.md) | 보완 및 개선점 보고서 | 12개 섹션 개선 완료 (모듈 분할, ESM, 테스트, CI/CD, UI/UX, 콘텐츠 학습 보조, 매뉴얼 재정리, 이야기형 교재 서사 개선, 기출문제 링크 연동 등) |

---

## 👤 사용자 문서 (docs/user/)

| 문서 | 설명 | 접근 방법 |
|------|------|-----------|
| [user_manual.md](user/user_manual.md) | 사용자 매뉴얼 | 앱 내 "매뉴얼" 메뉴 또는 직접 열기 |
| [학습안내서.md](../content/학습안내서.md) | 학습 안내서 | 앱 내 "요약집" 메뉴 또는 직접 열기 (`content/` 폴더) |

> 사용자 문서는 앱의 `manual-viewer.js`가 런타임에 fetch하여 인앱 오버레이로 렌더링합니다.

---

## 🔗 루트 문서

| 문서 | 설명 |
|------|------|
| [README.md](../README.md) | 프로젝트 소개, 기능, 기술 스택, 폴더 구조, 시작하기 |

---

## 📌 문서 작성 규칙

- **업데이트 날짜**: 각 문서 상단에 `최종 업데이트` 명시
- **링크**: 상대 경로 사용 (`../`, `dev/`, `user/`)
- **Mermaid 다이어그램**: CSP `unsafe-eval` 허용으로 인앱 및 GitHub 렌더링 지원
- **인코딩**: UTF-8 (BOM 없음)
