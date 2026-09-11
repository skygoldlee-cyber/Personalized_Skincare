// paths.js — 콘텐츠/데이터/벤더 경로 중앙 관리
// 모든 content/, data/, vendor/, docs/ 경로는 이 모듈에서 import하여 사용.

export const PATHS = {
  // 콘텐츠 베이스
  CONTENT_BASE: 'content',
  CONTENT_BASE_REL: './content',

  // 교재
  TEXTBOOK_DIR: (subjDir) => `content/${subjDir}`,
  TEXTBOOK_FILE: (subjDir, file) => `content/${subjDir}/${file}`,
  TEXTBOOK_FILE_REL: (subjDir, file) => `./content/${subjDir}/${file}`,

  // 문제은행
  EXAM_BANK: (fileName) => `content/문제은행/${fileName}`,

  // 참조자료
  REFERENCE_BASE: 'content/참조자료',
  REFERENCE_FILE: (dirName, file) => `content/참조자료/${dirName}/${file}`,
  REFERENCE_MD: (base, ext) => `content/참조자료/ref_md/${base}/${base}${ext}`,

  // 오디오북
  AUDIOBOOK_MP3: (subjId, chNo, num, title) =>
    `content/audiobook/mp3/${subjId}/ch${chNo}_${num}_${title}.mp3`,

  // 숫자 연습
  NUMBER_DRILLS: (subjId) => `content/number-drills/${subjId}.json`,

  // 학습 안내서
  STUDY_GUIDE: 'content/학습안내서.md',

  // 매니페스트
  MANIFEST_URL: './content/manifest.json',

  // file:// 폴백 번들
  STUDY_MD_MANIFEST_BUNDLE: './data/study_md/manifest.js',
  STUDY_MD_SUBJECT_BUNDLE: (key) => `./data/study_md/${key}.js`,

  // 벤더
  VENDOR_MERMAID: './vendor/mermaid/mermaid.min.js',

  // 문서
  USER_MANUAL: 'docs/user/user_manual.md',
};

// 참조자료 경로 상대 경로를 절대 경로로 정규화
export function normalizeRefPath(rawPath) {
  return decodeURIComponent(
    rawPath.replace(/^\.\.\/참조자료\//, 'content/참조자료/')
  );
}
