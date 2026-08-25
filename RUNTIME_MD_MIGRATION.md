# 교재/카드/퀴즈 런타임 MD 파싱 전환

## 무엇이 바뀌었나

교재 본문·플래시카드·퀴즈(STUDY_DATA)를 **사전 빌드된 `data/subjects/*.js` 번들**에서
읽던 방식을, **`content/*.md`를 런타임에 fetch → 브라우저에서 파싱**하는 방식으로 전환했다.
문제집(exam)과 매뉴얼(manual)이 쓰던 런타임 MD 방식과 통일된 것이다.

- **http(s)**: `content/manifest.json` + `content/**/*.md`를 라이브 fetch → 항상 최신, **재빌드 불필요**
- **file://**: fetch가 차단되므로 `data/study_md.js`(`window.__STUDY_MD__`) 폴백 번들에서 원문 조회
- http에서 개별 MD fetch가 실패하면 자동으로 같은 폴백 번들로 복구

## 진도/북마크 보존 (가장 중요)

카드·퀴즈 ID는 `sha256(subjectKey|chapterKey|term)`의 앞 6자리다. 브라우저용 동기 SHA-256
(`src/sha256.js`)이 빌드타임 Node `crypto`와 **바이트 단위로 동일**함을 검증했고, 포팅한 파서
(`src/textbook-parser.js`)의 출력이 기존 4개 번들과 **카드/퀴즈/챕터 전부 완전 일치**함을
전 과목(카드 1,178 / 퀴즈 11 / 챕터 19)에 대해 확인했다. 따라서 기존 localStorage 진도·북마크가
그대로 유효하다.

## 새로 추가된 파일

- `src/sha256.js` — 순수 동기 SHA-256 + `stableId()` (외부 의존성 없음)
- `src/textbook-parser.js` — `tools/build/plugins/textbook.plugin.js`의 브라우저 포팅. `buildSubjectData()`
- `tools/build_study_md_bundle.js` — file:// 폴백 번들 생성기
- `data/study_md.js` — 생성된 file:// 폴백 번들 (매니페스트 + 전체 MD 원문 인라인)

## 수정된 파일

- `src/data-loader.js` — `loadSubject()`가 MD fetch + 파싱으로 동작(인터페이스·나머지 메서드 동일)
- `src/app.js` — 리더 "원본 HTML" 버튼 → "원본 MD"(링크가 `.md`를 가리킴)
- `sw.js` — 새 모듈 프리캐시 추가, `CACHE_VERSION` v21로 bump (`.md`는 이미 Cache First라 로직 변경 없음)
- `.vercelignore` — content HTML 관련 주석 갱신, `data/subjects/` 배포 제외 추가

## 삭제된 파일

- `content/**/*.html` (19개) — 미사용 정적 렌더 산출물(어디서도 로드 안 됨, Vercel 배포에서도 제외돼 있었음)
- `data/subjects/*.js` (4개) — 런타임 MD 파싱으로 대체된 과목 번들
- `tools/convert_study_docs.ps1` — MD→HTML 정적 생성기(전면 폐기)

## 폴백 번들 재생성

`content/*.md`를 수정한 뒤 file:// 지원이 필요하면:

```
node tools/build_study_md_bundle.js
```

http(s) 배포에서는 이 번들 없이도 라이브 fetch로 최신 MD가 반영된다.

## 두 파서 동기화 규약 (중요)

교재 파싱 로직은 이제 **두 곳**에 존재한다: 런타임 `src/textbook-parser.js` 와 빌드 `tools/build/plugins/textbook.plugin.js`.
둘 중 하나의 규칙만 바뀌면 카드/퀴즈 ID·내용이 조용히 어긋날 수 있으므로, 등가성 자동 검증을 두었다:

```
npm run check:parser
```

두 파서를 현재 `content/*.md` 에 대해 실행해 `{name, cards, quizzes, chapters}` 가 바이트 단위로
동일한지 대조하고, 다르면 첫 불일치 항목을 출력하며 종료코드 1로 실패한다. `npm run build:data`
실행 시 `postbuild:data` 훅으로 자동 수행되고, `npm test` 로도 실행된다. **파서 규칙을 바꿀 때는
반드시 양쪽을 함께 수정하고 `npm run check:parser` 로 확인할 것.**

> Node가 `src/*.js` 를 ESM으로 인식하도록 `src/package.json`(`{"type":"module"}`)을 추가했다.
> 브라우저는 이 파일을 읽지 않으며, `tools/`·`serve.js`(CommonJS)에는 영향이 없다.

## 알려진 후속 정리(선택)

- 대시보드 과목별 카드/퀴즈 개수는 아직 `data/registry.js`의 정적 stats를 참조한다. `content/*.md`를
  대폭 수정하면 이 숫자만 실제 파싱 결과와 어긋날 수 있다. `loadSubject()` 후 실제 개수로 갱신하면 해소된다.
- `tools/build/plugins/textbook.plugin.js`는 이제 앱 로드에 불필요하지만, `src/textbook-parser.js`와의
  로직 동기화 기준(정답 소스)으로 남겨두었다. 향후 파서 규칙을 바꾸면 양쪽을 함께 수정하고
  `npm run check:parser` 로 등가성을 확인할 것(위 "두 파서 동기화 규약" 참조).
- `docs/ARCHITECTURE.md` 등 문서의 데이터 흐름 설명은 이 전환에 맞춰 갱신이 필요하다.
