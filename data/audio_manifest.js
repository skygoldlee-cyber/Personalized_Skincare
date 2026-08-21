// 자동 생성: 오디오 매니페스트 (audio_manifest.js)
// audiobook/_gen_manifest.js 로 재생성 가능. 수동 편집 주의.
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
const AUDIO_BASE_URL = null; // null = 로컬 개발 모드, 문자열 = 외부 CDN URL

const AUDIO_MANIFEST = {
  "law": {
    "0": "audiobook/mp3/law/ch01_1_화장품법2026.mp3",
    "1": "audiobook/mp3/law/ch02_2_개인정보_보호법2026.mp3"
  },
  "manufacturing": {
    "0": "audiobook/mp3/manufacturing/ch01_1_화장품_원료의_종류와_특성_및_제품의_제조관리2026.mp3",
    "1": "audiobook/mp3/manufacturing/ch02_2_화장품의_기능과_품질2026.mp3",
    "2": "audiobook/mp3/manufacturing/ch03_3_화장품_사용제한_원료2026.mp3",
    "3": "audiobook/mp3/manufacturing/ch04_4_화장품_관리2026.mp3",
    "4": "audiobook/mp3/manufacturing/ch05_5_위해사례_판단_및_보고2026.mp3"
  },
  "safety": {
    "0": "audiobook/mp3/safety/ch01_1_작업장_위생관리2026.mp3",
    "1": "audiobook/mp3/safety/ch02_2_작업자_위생관리2026.mp3",
    "2": "audiobook/mp3/safety/ch03_3_설비_및_기구관리2026.mp3",
    "3": "audiobook/mp3/safety/ch04_4_내용물_및_원료관리2026.mp3",
    "4": "audiobook/mp3/safety/ch05_5_포장재의_관리2026.mp3"
  },
  "understanding": {
    "0": "audiobook/mp3/understanding/ch01_1_맞춤형화장품_개요2026.mp3",
    "1": "audiobook/mp3/understanding/ch02_2_피부_및_모발의_생리구조2026.mp3",
    "2": "audiobook/mp3/understanding/ch03_3_관능평가_방법과_절차2026.mp3",
    "3": "audiobook/mp3/understanding/ch04_4_제품_상담2026.mp3",
    "4": "audiobook/mp3/understanding/ch05_5_제품_안내2026.mp3",
    "5": "audiobook/mp3/understanding/ch06_6_혼합_및_소분2026.mp3",
    "6": "audiobook/mp3/understanding/ch07_7_충진_및_포장2026.mp3"
  }
};

/**
 * 오디오 파일의 실제 접근 URL을 반환한다.
 * AUDIO_BASE_URL이 설정되어 있으면 외부 URL로, 아니면 로컬 상대 경로로 변환.
 * @param {string} localPath - 매니페스트에 저장된 로컬 경로
 * @returns {string} 실제 재생 가능한 URL
 */
function getAudioUrl(localPath) {
  if (!localPath) return null;
  if (AUDIO_BASE_URL && typeof AUDIO_BASE_URL === 'string' && AUDIO_BASE_URL.trim() !== '') {
    // 외부 CDN 사용: base URL + 파일명만 추출하여 조합
    const fileName = localPath.split('/').pop();
    const subjDir = localPath.split('/').slice(-2, -1)[0]; // law, manufacturing 등
    return `${AUDIO_BASE_URL.replace(/\/$/, '')}/${subjDir}/${fileName}`;
  }
  // 로컬 개발 모드: 기존 상대 경로 그대로 사용
  return localPath;
}

if (typeof window !== "undefined") {
  window.AUDIO_MANIFEST = AUDIO_MANIFEST;
  window.AUDIO_BASE_URL = AUDIO_BASE_URL;
  window.getAudioUrl = getAudioUrl;
}
