# 📚 문서 인덱스 (Documentation Index)

> **Cosmetic Pass Master** — 맞춤형화장품 조제관리사 스마트 학습 플랫폼

---

## 📂 문서 구조

```
docs/
├── README.md                  ← 본 파일 (문서 인덱스)
├── dev/                       ← 개발 문서
│   ├── ARCHITECTURE.md        ← 아키텍처 및 설계 철학 (마인드맵·개선이력 포함)
│   ├── AUDIO_HOSTING_GUIDE.md ← 오디오북 호스팅 및 청취 가이드
│   ├── DEPLOYMENT_GUIDE.md    ← Vercel 배포 및 호스팅 가이드 (Git Push 절차 포함)
│   ├── MULTI_MACHINE_SETUP.md ← 다중 머신 개발 환경 설정
│   ├── TEXTBOOK_AUTHORING_GUIDE.md ← 교재 Markdown 작성 지침
│   ├── CHANGES.md             ← 코드 변경 이력 (Changelog)
│   ├── SPEC.md                ← 기능 명세
│   ├── FLASHCARD_LOGIC.md     ← 플래시카드 로직 명세
│   ├── MD_TO_HTML_LOGIC.md    ← MD→HTML 변환 로직
│   ├── TESTING.md             ← 테스트 가이드
│   └── SUBSCRIPTION_ROADMAP.md ← 구독 로드맵
├── report_archive/            ← 분석 보고서 아카이브 (앱 미참조)
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
| [TEXTBOOK_AUTHORING_GUIDE.md](dev/TEXTBOOK_AUTHORING_GUIDE.md) | 교재 Markdown 작성 지침 | 디렉토리 구조, manifest.json, 카드/퀴즈 추출 규칙, 문제은행 형식, 빌드 검증 |
| [CHANGES.md](dev/CHANGES.md) | 코드 변경 이력 (Changelog) | #42 기출문제 링크 클릭 시 문제집 HTML 뷰어 연동, #41 이야기형 교재 5가지 서사 개선+외부 리뷰, #27 매뉴얼 재정리, #26 교재 5대 학습 보조 개선 |
| [SPEC.md](dev/SPEC.md) | 기능 명세 | 핵심 기능, 데이터 구조, 뷰 명세 |
| [FLASHCARD_LOGIC.md](dev/FLASHCARD_LOGIC.md) | 플래시카드 로직 | 카드 생성, 난이도, 필터, 셔플 로직 |
| [MD_TO_HTML_LOGIC.md](dev/MD_TO_HTML_LOGIC.md) | MD→HTML 변환 로직 | 런타임 파싱, 섹션 분할, 렌더링 |
| [TESTING.md](dev/TESTING.md) | 테스트 가이드 | 유닛 테스트, DOM 테스트, 파서 등가성 검사 |
| [SUBSCRIPTION_ROADMAP.md](dev/SUBSCRIPTION_ROADMAP.md) | 구독 로드맵 | 향후 유료화 방향 |

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
