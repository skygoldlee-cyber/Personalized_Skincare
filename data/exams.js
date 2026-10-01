// 자동 생성된 시험 레지스트리 번들입니다. 수정하지 마십시오.
// 원본: content/exams.json (생성: node tools/build/build_exams_list.js)
var EXAMS_LIST = {
  "schemaVersion": 1,
  "note": "시험 레지스트리 — 새 시험은 이 파일에 엔트리를 추가하고 content/exams/<id>/ + data/exams/<id>/ 구조로 콘텐츠를 배치한다 (모든 시험이 대칭 구조). data/exams.js 는 tools/build_exams_list.js가 이 파일에서 생성한다.",
  "exams": [
    {
      "id": "cosmetic",
      "name": "맞춤형화장품 조제관리사",
      "shortName": "조제관리사",
      "appName": "Passmula",
      "title": "Passmula — 맞춤형화장품 조제관리사",
      "logoMain": "Pass",
      "logoSub": "mula",
      "desc": "화장품법·제조·품질관리·안전관리·맞춤형화장품 4과목 · 문제은행 1,000문",
      "icon": "fa-solid fa-wand-magic-sparkles",
      "year": "2027",
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
        "audiobook": false,
        "refDocs": true,
        "appendixDocs": true,
        "pomodoro": true,
        "formula": true,
        "limitsTrainer": true,
        "studyGuide": true,
        "userManual": true
      }
    },
    {
      "id": "food",
      "name": "식품기사",
      "shortName": "식품기사",
      "appName": "식품기사",
      "title": "식품기사",
      "logoMain": "식품",
      "logoSub": "기사",
      "desc": "식품위생학(법령 암기형) Phase C 파일럿 — 식품위생법·식품공전·표시기준 인용 체인 검증",
      "icon": "fa-solid fa-bowl-food",
      "year": "2027",
      "comingSoon": true,
      "contentRoot": "content/exams/food",
      "dataRoot": "data/exams/food",
      "manifestPath": "content/exams/food/manifest.json",
      "registryBundle": "data/exams/food/registry.js",
      "registryGlobal": "DATA_REGISTRY_FOOD",
      "features": {
        "refDocs": true,
        "dictionary": true
      }
    }
  ]
};
if (typeof window !== 'undefined') { window.EXAMS_LIST = EXAMS_LIST; }
if (typeof module !== 'undefined' && module.exports) { module.exports = EXAMS_LIST; }
