// tools/build/build-audio-manifest.js
// 각 시험의 {contentRoot}/audiobook/mp3/ 디렉토리 스캔 → data/audio_manifest.js 자동 생성
// [멀티시험] content/exams.json의 모든 시험을 순회해 시험 id 키로 분리된 매니페스트를
//           단일 파일(data/audio_manifest.js — 항상 앱 공용 data 루트)로 발행한다.
//           런타임(reader-audio.js)은 활성 시험 id로 자신의 매니페스트를 선택한다.
// 실행: node tools/build/build-audio-manifest.js
const fs = require('fs');
const path = require('path');
const { getExamTargets } = require('./exam-targets');

const WORKSPACE_DIR = path.resolve(__dirname, '..', '..');
const OUT_PATH = path.join(WORKSPACE_DIR, 'data', 'audio_manifest.js');

function scanExamAudio(target) {
  const audioDir = path.join(WORKSPACE_DIR, target.contentRoot, 'audiobook', 'mp3');
  const manifest = {};
  if (!fs.existsSync(audioDir)) return manifest;

  const subjectDirs = fs.readdirSync(audioDir).filter(d =>
    fs.statSync(path.join(audioDir, d)).isDirectory()
  );

  for (const subjKey of subjectDirs) {
    const subjPath = path.join(audioDir, subjKey);
    const mp3Files = fs.readdirSync(subjPath)
      .filter(f => f.endsWith('.mp3'))
      .sort();

    if (mp3Files.length > 0) {
      manifest[subjKey] = {};
      mp3Files.forEach((file, idx) => {
        manifest[subjKey][String(idx)] = `${target.contentRoot}/audiobook/mp3/${subjKey}/${file}`;
      });
    }
  }
  return manifest;
}

function build() {
  // 기존 파일에서 AUDIO_BASE_URL과 AUDIO_MANIFEST 보존
  let audioBaseUrl = 'null';
  let existingManifest = null;
  if (fs.existsSync(OUT_PATH)) {
    const existing = fs.readFileSync(OUT_PATH, 'utf-8');
    const urlMatch = existing.match(/export const AUDIO_BASE_URL = (.+?);/);
    if (urlMatch) audioBaseUrl = urlMatch[1].trim();
    // 기존 AUDIO_MANIFEST 추출 (JSON 블록)
    const manifestMatch = existing.match(/export const AUDIO_MANIFEST = (\{[\s\S]*?\n\});/);
    if (manifestMatch) {
      try { existingManifest = JSON.parse(manifestMatch[1]); } catch (_) {}
    }
  }

  const manifest = {};
  for (const target of getExamTargets(WORKSPACE_DIR)) {
    const scanned = scanExamAudio(target);
    if (Object.keys(scanned).length > 0) {
      manifest[target.id] = scanned;
    } else if (existingManifest && existingManifest[target.id]) {
      // 스캔 결과가 비어있으면(오디오 미커밋 등) 기존 매니페스트 보존
      manifest[target.id] = existingManifest[target.id];
    }
  }

  const output = `// 자동 생성: 오디오 매니페스트 (audio_manifest.js)
// tools/build/build-audio-manifest.js로 재생성 가능. 수동 편집 주의.
//
// [Vercel 배포용 수정]
// - AUDIO_BASE_URL: 오디오 파일이 호스팅된 외부 CDN/스토리지 주소
// - null 또는 ''로 설정하면 로컬 경로(개발용) 사용
// - 예: 'https://your-project.vercel.app' 또는 'https://cdn.example.com/audio'
//
// ⚠️ 중요: Vercel에 MP3를 함께 올리면 용량 초과(302MB)로 배포 실패합니다.
//    아래 방법 중 하나를 선택하세요:
//    1) GitHub Releases에 MP3 업로드 후 raw URL 사용
//    2) Cloudflare R2 / AWS S3 / GCS에 업로드
//    3) 별도 Vercel 프로젝트로 오디오만 배포
//
// [멀티시험] AUDIO_MANIFEST는 시험 id 키로 분리된다:
//    AUDIO_MANIFEST['<examId>'][<subjectKey>][<chapterIdx>] = '<contentRoot>/audiobook/...'
/** @type {string|null} */
export const AUDIO_BASE_URL = ${audioBaseUrl};

/** @type {Object<string, import('../src/types.js').AudioManifest>} */
export const AUDIO_MANIFEST = ${JSON.stringify(manifest, null, 2)};

/**
 * 활성 시험의 오디오 매니페스트를 반환한다.
 * 시험 키가 없으면(구형 단일 매니페스트 형식) 전체를 그대로 돌려준다.
 * @param {string} examId
 */
export function getAudioManifest(examId) {
  if (examId && AUDIO_MANIFEST && AUDIO_MANIFEST[examId]) return AUDIO_MANIFEST[examId];
  return AUDIO_MANIFEST;
}

/**
 * 오디오 파일의 실제 접근 URL을 반환한다.
 * AUDIO_BASE_URL이 설정되어 있으면 외부 URL로, 아니면 로컬 상대 경로로 변환.
 * @param {string|null} localPath - 매니페스트에 저장된 로컬 경로
 * @returns {string|null} 실제 재생 가능한 URL(입력이 비면 null)
 */
export function getAudioUrl(localPath) {
  if (!localPath) return null;
  if (AUDIO_BASE_URL && typeof AUDIO_BASE_URL === 'string' && AUDIO_BASE_URL.trim() !== '') {
    // 외부 CDN 사용: base URL + 파일명만 추출하여 조합
    const fileName = localPath.split('/').pop();
    const subjDir = localPath.split('/').slice(-2, -1)[0]; // law, manufacturing 등
    return \`\${AUDIO_BASE_URL.replace(/\\/$/, '')}/\${subjDir}/\${fileName}\`;
  }
  // 로컬 개발 모드: 기존 상대 경로 그대로 사용
  return localPath;
}

if (typeof window !== "undefined") {
  window.AUDIO_MANIFEST = AUDIO_MANIFEST;
  window.AUDIO_BASE_URL = AUDIO_BASE_URL;
  window.getAudioManifest = getAudioManifest;
  window.getAudioUrl = getAudioUrl;
}
`;

  fs.writeFileSync(OUT_PATH, output, 'utf-8');
  console.log('Generated: data/audio_manifest.js');
  for (const [examId, m] of Object.entries(manifest)) {
    console.log(`  [${examId}] subjects: ${Object.keys(m).join(', ')}`);
  }
}

build();
