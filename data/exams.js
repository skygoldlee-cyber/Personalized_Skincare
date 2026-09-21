// 자동 생성된 시험 레지스트리 번들입니다. 수정하지 마십시오.
// 원본: content/exams.json (생성: node tools/build_exams_list.js)
var EXAMS_LIST = {
  "schemaVersion": 1,
  "note": "시험 레지스트리 — 새 시험은 이 파일에 엔트리를 추가하고 content/exams/<id>/ + data/exams/<id>/ 구조로 콘텐츠를 배치한다 (모든 시험이 대칭 구조). data/exams.js 는 tools/build_exams_list.js가 이 파일에서 생성한다.",
  "exams": [
    {
      "id": "cosmetic",
      "name": "맞춤형화장품 조제관리사",
      "shortName": "조제관리사",
      "title": "Passmula — 맞춤형화장품 조제관리사",
      "logoMain": "Pass",
      "logoSub": "mula",
      "desc": "화장품법·제조·품질관리·안전관리·맞춤형화장품 4과목 · 문제은행 1,000문",
      "icon": "fa-solid fa-wand-magic-sparkles",
      "year": "2026",
      "default": true,
      "contentRoot": "content/exams/cosmetic",
      "dataRoot": "data/exams/cosmetic",
      "manifestPath": "content/exams/cosmetic/manifest.json",
      "registryBundle": "data/exams/cosmetic/registry.js",
      "registryGlobal": "DATA_REGISTRY",
      "features": {
        "dictionary": true,
        "calcPractice": true,
        "ingredients": true,
        "audiobook": true,
        "refDocs": true,
        "appendixDocs": true,
        "pomodoro": true,
        "formula": true
      }
    }
  ]
};
if (typeof window !== 'undefined') { window.EXAMS_LIST = EXAMS_LIST; }
if (typeof module !== 'undefined' && module.exports) { module.exports = EXAMS_LIST; }
