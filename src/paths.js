// paths.js — 콘텐츠/데이터/벤더 경로 중앙 관리
// 모든 content/, data/, vendor/, docs/ 경로는 이 모듈에서 import하여 사용.
//
// [멀티시험] 경로는 활성 시험(exam-context)의 contentRoot/dataRoot를 기준으로
// 동적 생성된다. getter/함수이므로 호출 시점의 활성 시험이 반영된다.

import { contentPath, dataPath } from './exam-context.js';

export const PATHS = {
  // 콘텐츠 베이스
  get CONTENT_BASE() { return (contentPath('x').slice(0, -2)); },
  get CONTENT_BASE_REL() { return `./${PATHS.CONTENT_BASE}`; },

  // 교재
  TEXTBOOK_DIR: (subjDir) => contentPath(subjDir),
  TEXTBOOK_FILE: (subjDir, file) => contentPath(`${subjDir}/${file}`),
  TEXTBOOK_FILE_REL: (subjDir, file) => `./${contentPath(`${subjDir}/${file}`)}`,

  // 문제은행
  EXAM_BANK: (fileName) => contentPath(`문제은행/${fileName}`),

  // 참조자료
  get REFERENCE_BASE() { return contentPath('참조자료'); },
  REFERENCE_FILE: (dirName, file) => contentPath(`참조자료/${dirName}/${file}`),
  REFERENCE_MD: (base, ext, subj) => contentPath(`참조자료/ref_md/${subj ? `과목${subj}/` : ''}${base}/${base}${ext}`),

  // 오디오북
  AUDIOBOOK_MP3: (subjId, chNo, num, title) =>
    contentPath(`audiobook/mp3/${subjId}/ch${chNo}_${num}_${title}.mp3`),

  // 숫자 연습
  NUMBER_DRILLS: (subjId) => contentPath(`number-drills/${subjId}.json`),

  // 학습 안내서
  get STUDY_GUIDE() { return contentPath('학습안내서.md'); },

  // 두음법·숫자 암기 총정리 (두음법 Part 1 + 중요 숫자 Part 2 통합 문서)
  get MNEMONIC_GUIDE() { return contentPath('두음법_암기_총정리.md'); },

  // 매니페스트
  get MANIFEST_URL() { return `./${contentPath('manifest.json')}`; },

  // file:// 폴백 번들
  get STUDY_MD_MANIFEST_BUNDLE() { return `./${dataPath('study_md/manifest.js')}`; },
  STUDY_MD_SUBJECT_BUNDLE: (key) => `./${dataPath(`study_md/${key}.js`)}`,

  // 벤더 (앱 공용)
  VENDOR_MERMAID: './vendor/mermaid/mermaid.min.js',

  // 문서 (앱 공용)
  USER_MANUAL: 'docs/user/user_manual.md',
};

// 참조자료 경로 상대 경로를 절대 경로로 정규화
export function normalizeRefPath(rawPath) {
  return decodeURIComponent(
    rawPath.replace(/^\.\.\/참조자료\//, `${contentPath('참조자료')}/`)
  );
}
