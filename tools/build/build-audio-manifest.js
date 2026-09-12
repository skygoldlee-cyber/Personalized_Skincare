// tools/build/build-audio-manifest.js
// content/audiobook/mp3/ 디렉토리 스캔 → data/audio_manifest.js 자동 생성
// 실행: node tools/build/build-audio-manifest.js
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.resolve(__dirname, '..', '..');
const AUDIO_DIR = path.join(WORKSPACE_DIR, 'content', 'audiobook', 'mp3');
const OUT_PATH = path.join(WORKSPACE_DIR, 'data', 'audio_manifest.js');

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

  // mp3 디렉토리가 있으면 스캔, 없으면 기존 매니페스트 유지
  if (fs.existsSync(AUDIO_DIR)) {
    const subjectDirs = fs.readdirSync(AUDIO_DIR).filter(d =>
      fs.statSync(path.join(AUDIO_DIR, d)).isDirectory()
    );

    for (const subjKey of subjectDirs) {
      const subjPath = path.join(AUDIO_DIR, subjKey);
      const mp3Files = fs.readdirSync(subjPath)
        .filter(f => f.endsWith('.mp3'))
        .sort();

      if (mp3Files.length > 0) {
        manifest[subjKey] = {};
        mp3Files.forEach((file, idx) => {
          manifest[subjKey][String(idx)] = `content/audiobook/mp3/${subjKey}/${file}`;
        });
      }
    }
  }

  // 스캔 결과가 비어있으면 기존 매니페스트 유속
  const finalManifest = Object.keys(manifest).length > 0 ? manifest : (existingManifest || {});

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
/** @type {string|null} */
export const AUDIO_BASE_URL = ${audioBaseUrl};

/** @type {import('../src/types.js').AudioManifest} */
export const AUDIO_MANIFEST = ${JSON.stringify(finalManifest, null, 2)};

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
  window.getAudioUrl = getAudioUrl;
}
`;

  fs.writeFileSync(OUT_PATH, output, 'utf-8');
  console.log('Generated: data/audio_manifest.js');
  console.log('Subjects:', Object.keys(finalManifest).join(', '));
}

build();
