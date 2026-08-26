# 🧠 Cosmetic Pass Master — 프로젝트 마인드맵

> **최종 업데이트**: 2026-08-26
> **목적**: 프로젝트 전체 구조를 마인드맵 다이어그램으로 시각화하여 한눈에 파악

---

## 📋 마인드맵 (Mermaid)

> GitHub 및 Mermaid 지원 뷰어에서 렌더링됩니다.

```mermaid
mindmap
  root((Cosmetic Pass Master))
    설계 철학
      Zero-Backend
        서버리스 정적 아키텍처
        localStorage 기반 진행상황
        Vercel 무료 호스팅
      Vanilla First
        프레임워크 제로 의존
        순수 HTML/CSS/JS
        외부 런타임 라이브러리 최소화
      Offline-Capable PWA
        Service Worker 캐싱
        오프라인 학습 지원
        홈화면 설치 가능
      Mobile-First
        데스크톱 사이드바 / 모바일 하단탭
        safe-area 및 동적 뷰포트
        가로/세로 대응
    아키텍처 계층
      Presentation Layer
        index.html — SPA App Shell
        style.css — 디자인 시스템
        css/ — 6개 분할 CSS
        manifest.webmanifest — PWA 매니페스트
      Application Layer
        app.js — 메인 오케스트레이터
        charts.js — SVG 차트
        scratchpad.js — Canvas 손글씨
        trainer-calc.js — 계산 문제 생성
        state.js — 전역 상태 + 영속성
        sanitize.js — XSS 방어
        sha256.js — 안정 ID 생성
        markdown-parser.js — MD → HTML
        textbook-parser.js — 교재 파서
        data-loader.js — 온디맨드 로더
        exam-viewer.js — 문제집 뷰어
        manual-viewer.js — 매뉴얼 뷰어
        types.js — JSDoc 타입 선언
        utils.js — 범용 헬퍼
        ui-utils.js — 로딩 UI
        reader-format.js — 리더 포맷터
        theme-init.js — 테마 초기화
        pwa-install-capture.js — PWA 설치
        app-fallback.js — ESM 실패 복구
      Views Layer
        dashboard.js — 대시보드
        flashcard.js — 플래시카드
        quiz.js — 퀴즈 + 데일리 챌린지
        trainer.js — 스마트 훈련소
        exam-simulator.js — 모의고사 OMR
        dictionary.js — 성분 사전
        textbook-search.js — 교재 검색
        textbook-reader.js — 교재 리더
        backup.js — 데이터 백업/복원
        navigation.js — 뷰 전환 유틸
      Data Layer
        registry.js — 빌드 생성 메타
        content/*.md — SSOT 원본
        data/exams/*.hash.js — 시험 번들
        data/ingredients_data.*.js — 성분 사전
        data/study_md/ — file:// 폴백
        data/id_migration.js — ID 마이그레이션
        data/audio_manifest.js — 오디오 메타
      Persistence Layer
        localStorage — 학습 진행·설정
        Cache Storage — SW 캐시
    콘텐츠 구조
      과목 4개
        화장품법의 이해 law
        화장품 제조 및 품질관리 manufacturing
        유통화장품 안전관리 safety
        맞춤형화장품의 이해 understanding
      시험 9개
        subject1 100문제
        subject2_p1/p2/p3 298문제
        subject3_p1/p2 200문제
        subject4_p1/p2/p3 299문제
      성분 사전
        1357개 원료
        가용/금지/제한 분류
      오디오북
        45개 챕터 MP3
        외부 CDN 호스팅
      추천 리소스
        유튜브 채널 요약
        외부 공식 링크
    빌드 파이프라인
      tools/build/index.js
        매니페스트 로드 및 검증
        과목별 카드/퀴즈 빌드
        시험 번들 생성
        성분 사전 파싱
        registry.js 출력
        SW 버전 스탬프
      plugins/
        textbook.plugin.js
        exams.plugin.js
        ingredients.plugin.js
      지원 도구
        stamp-sw-version.js
        manifest-loader.js
        id-factory.js
        schema.js
        report.js
      검증
        check_parser_parity.js
        verify-shell-assets.js
    PWA & Service Worker
      캐시 전략 8단계
        1 Navigation Cache First
        2 데이터 번들 Cache First
        3 외부 CDN SWR
        4 MP3 바이패스
        5 src JS Cache First
        6 CSS Cache First
        7 그 외 JS Network First
        8 App Shell SWR
      프리캐시
        App Shell HTML/CSS/JS
        웹폰트 자체 호스팅
        FontAwesome 자체 호스팅
      캐시 버전 관리
        빌드타임 자동 치환
        배포 시 구 캐시 자동 정리
    보안
      CSP
        script-src self
        style-src self unsafe-inline
        object-src none
        frame-ancestors none
      XSS 방어
        sanitize.js escapeHTML
        markdown-parser 자동 이스케이프
      인라인 핸들러 제거
        onchange → addEventListener
        data-click 속성 기반 위임
    테스트
      Unit Tests
        stableId 7개
        shortHash 7개
        escapeHTML 5개
        safeTextWithBreaks 3개
        sha256hex 7개
        loadProgress 6개
        saveProgress 3개
        cleanOrphans 4개
        parseMarkdownFile 10개
        parseTextbookContent 5개
        buildSubjectData 6개
        buildCalcQuestion 7개
        getChosung 7개
      DOM Tests
        vitest + jsdom
      CI/CD
        GitHub Actions
        Vercel 배포
    주요 기능
      학습 도구
        플래시카드 암기
        빈칸 채우기 퀴즈
        데일리 챌린지
        오답 노트
      모의고사
        OMR 시뮬레이터
        과목별/통합 모의고사
        오답 복습 연동
        결과 차트
      스마트 훈련
        계산 문제 훈련
        한도 계산
        배합량 계산
        희석 농도 계산
      교재
        교재 검색
        교재 리더
        오디오북 재생
        Media Session API
      부가 기능
        성분 사전
        뽀모도로 타이머
        학습 통계 차트
        데이터 백업/복원
        사용자 매뉴얼
```

---

## 📋 텍스트 트리 (Mermaid 미지원 환경용)

```
Cosmetic Pass Master
├── 🎯 설계 철학
│   ├── Zero-Backend (서버리스)
│   │   ├── localStorage 기반 진행상황
│   │   └── Vercel 무료 정적 호스팅
│   ├── Vanilla First (프레임워크 제로)
│   │   ├── 순수 HTML/CSS/JS
│   │   └── 외부 런타임 라이브러리 최소화
│   ├── Offline-Capable PWA
│   │   ├── Service Worker 캐싱
│   │   └── 홈화면 설치 가능
│   └── Mobile-First 반응형
│       ├── 데스크톱 사이드바 / 모바일 하단탭
│       └── safe-area + 동적 뷰포트
│
├── 🏗️ 아키텍처 계층
│   ├── Presentation Layer
│   │   ├── index.html (SPA App Shell)
│   │   ├── style.css + css/ (6개 분할)
│   │   └── manifest.webmanifest
│   ├── Application Layer (src/)
│   │   ├── app.js — 메인 오케스트레이터 (1,384줄)
│   │   ├── charts.js — SVG 차트 (인터랙티브 툴팁)
│   │   ├── state.js — 전역 상태 + localStorage 영속성
│   │   ├── data-loader.js — 온디맨드 데이터 로더
│   │   ├── textbook-parser.js — 교재 MD 런타임 파서
│   │   ├── markdown-parser.js — 공통 MD → HTML 변환
│   │   ├── exam-viewer.js — 문제집 뷰어
│   │   ├── manual-viewer.js — 매뉴얼 뷰어
│   │   ├── sanitize.js — XSS 방어
│   │   ├── sha256.js — 안정 ID 생성
│   │   ├── trainer-calc.js — 계산 문제 생성기
│   │   ├── scratchpad.js — Canvas 손글씨
│   │   ├── types.js — JSDoc 타입 선언
│   │   ├── utils.js — 한글 초성 추출 등
│   │   ├── ui-utils.js — 로딩 UI
│   │   ├── theme-init.js — 테마 초기화
│   │   ├── pwa-install-capture.js — PWA 설치
│   │   └── app-fallback.js — ESM 로드 실패 복구
│   ├── Views Layer (src/views/)
│   │   ├── dashboard.js — 대시보드 + 통계
│   │   ├── flashcard.js — 플래시카드
│   │   ├── quiz.js — 퀴즈 + 데일리 챌린지
│   │   ├── trainer.js — 스마트 훈련소
│   │   ├── exam-simulator.js — 모의고사 OMR
│   │   ├── dictionary.js — 성분 사전
│   │   ├── textbook-search.js — 교재 검색
│   │   ├── textbook-reader.js — 교재 리더 (Media Session)
│   │   ├── backup.js — 데이터 백업/복원
│   │   └── navigation.js — 뷰 전환 유틸
│   ├── Data Layer
│   │   ├── data/registry.js — 빌드 생성 메타 번들
│   │   ├── content/*.md — SSOT 원본 (과목/시험/성분/추천)
│   │   ├── data/exams/*.hash.js — 시험 문항 번들 (9개)
│   │   ├── data/ingredients_data.*.js — 성분 사전 (1,357개)
│   │   ├── data/study_md/ — file:// 폴백 번들
│   │   ├── data/id_migration.js — 레거시 ID 매핑
│   │   └── data/audio_manifest.js — 오디오 메타
│   └── Persistence Layer
│       ├── localStorage — 학습 진행·설정
│       └── Cache Storage — SW 캐시
│
├── 📚 콘텐츠 구조
│   ├── 4과목 (1,178 카드 + 11 퀴즈)
│   │   ├── 화장품법의 이해 (law) — 131카드
│   │   ├── 화장품 제조 및 품질관리 (manufacturing) — 487카드
│   │   ├── 유통화장품 안전관리 (safety) — 195카드
│   │   └── 맞춤형화장품의 이해 (understanding) — 365카드
│   ├── 9시험 (897문제)
│   │   ├── subject1 (100문제)
│   │   ├── subject2_p1/p2/p3 (298문제)
│   │   ├── subject3_p1/p2 (200문제)
│   │   └── subject4_p1/p2/p3 (299문제)
│   ├── 성분 사전 — 1,357개 원료
│   ├── 오디오북 — 45개 챕터 MP3 (외부 CDN)
│   └── 추천 리소스 — 유튜브 채널 + 공식 링크
│
├── 🔧 빌드 파이프라인
│   ├── tools/build/index.js — 메인 빌드
│   ├── tools/build/plugins/
│   │   ├── textbook.plugin.js
│   │   ├── exams.plugin.js
│   │   └── ingredients.plugin.js
│   ├── tools/build/stamp-sw-version.js — SW 버전 자동 치환
│   ├── tools/build/manifest-loader.js
│   ├── tools/build/id-factory.js — 안정 ID 생성
│   ├── tools/build/schema.js — 매니페스트 검증
│   ├── tools/check_parser_parity.js — 빌드/런타임 파서 일치 검증
│   └── tools/verify-shell-assets.js — SW 자산 검증
│
├── 📡 PWA & Service Worker
│   ├── 캐시 전략 (8단계 분기)
│   │   ├── 1. Navigation (HTML) → Cache First
│   │   ├── 2. 데이터 번들 → Cache First
│   │   ├── 3. 외부 CDN → Stale-While-Revalidate
│   │   ├── 4. MP3 오디오 → 네트워크 바이패스
│   │   ├── 5. /src/*.js → Cache First
│   │   ├── 6. CSS → Cache First
│   │   ├── 7. 그 외 JS → Network First
│   │   └── 8. App Shell (아이콘/이미지) → SWR
│   ├── 프리캐시 자산
│   │   ├── App Shell (HTML/CSS/JS)
│   │   ├── 웹폰트 자체 호스팅 (Noto Sans KR + Outfit)
│   │   └── FontAwesome 자체 호스팅
│   └── 캐시 버전 — 빌드타임 자동 치환 (git short hash)
│
├── 🔒 보안
│   ├── CSP (Content Security Policy)
│   │   ├── script-src 'self'
│   │   ├── style-src 'self' 'unsafe-inline'
│   │   ├── object-src 'none'
│   │   └── frame-ancestors 'none'
│   ├── XSS 방어
│   │   ├── sanitize.js (escapeHTML)
│   │   └── markdown-parser (자동 HTML 이스케이프)
│   └── 인라인 핸들러 제거
│       ├── onchange → addEventListener (CSP fix)
│       └── data-click 속성 기반 이벤트 위임
│
├── 🧪 테스트
│   ├── Unit Tests (86개) — node --test
│   │   ├── stableId (7), shortHash (7)
│   │   ├── escapeHTML (5), safeTextWithBreaks (3)
│   │   ├── sha256hex (7)
│   │   ├── loadProgress (6), saveProgress (3)
│   │   ├── cleanOrphans (4)
│   │   ├── parseMarkdownFile (10), parseTextbookContent (5)
│   │   ├── buildSubjectData (6), buildCalcQuestion (7)
│   │   └── getChosung (7)
│   ├── DOM Tests — vitest + jsdom
│   └── CI/CD — GitHub Actions → Vercel
│
└── ✨ 주요 기능
    ├── 학습 도구
    │   ├── 플래시카드 암기 (외움/헷갈림)
    │   ├── 빈칸 채우기 기출 퀴즈
    │   ├── 데일리 챌린지 (4문제/일일)
    │   └── 오답 노트 자동 수집
    ├── 모의고사
    │   ├── OMR 시뮬레이터
    │   ├── 과목별 / 통합 모의고사
    │   ├── 오답 복습 연동
    │   └── 성적 차트 (레이더/꺾은선)
    ├── 스마트 훈련소
    │   ├── 계산 문제 (4타입)
    │   ├── 한도 내 최대 추가량
    │   ├── 배합량 계산
    │   └── 희석 농도 계산
    ├── 교재
    │   ├── 교재 검색 (초성/키워드)
    │   ├── 교재 리더 (MD → HTML)
    │   ├── 오디오북 재생 (Media Session API)
    │   └── 핵심 단권화 요약집
    └── 부가 기능
        ├── 성분 사전 (1,357개)
        ├── 뽀모도로 타이머
        ├── 학습 통계 차트 (SVG)
        ├── 데이터 백업/복원 (JSON)
        ├── 라이트/다크 테마
        └── 사용자 매뉴얼
```

---

## 📎 관련 문서

- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — 상세 아키텍처 설계 문서
- [`CHANGES.md`](../CHANGES.md) — 변경 이력 (Changelog)
- [`improvements_report.md`](../improvements_report.md) — 개선점 분석 및 구현 보고서
- [`README.md`](../README.md) — 프로젝트 소개 및 시작 가이드
