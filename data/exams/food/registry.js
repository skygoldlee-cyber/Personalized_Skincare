// 자동 생성된 데이터 레지스트리 파일입니다. 수정하지 마십시오.
var DATA_REGISTRY_FOOD = {
  "schemaVersion": 1,
  "contentYear": "2027",
  "generatedAt": "2026-09-30T01:14:28.881Z",
  "subjects": [
    {
      "key": "sanitation",
      "order": 1,
      "name": "식품위생학",
      "shortName": "위생학",
      "contentHash": "ec07ad90",
      "stats": {
        "cards": 6,
        "quizzes": 1,
        "chapters": 1,
        "sourceCards": 6,
        "sourceQuizzes": 1,
        "targetCards": 6,
        "targetQuizzes": 1
      }
    }
  ],
  "exams": [
    {
      "key": "subject1",
      "subject": "sanitation",
      "part": 1,
      "title": "식품위생법의 이해 (8제)",
      "file": "과목1_단일정답형.md",
      "bundle": "./data/exams/food/exams/subject1.df1fe251.js",
      "global": "EXAM_DATA_subject1",
      "contentHash": "df1fe251",
      "stats": {
        "questions": 8
      }
    }
  ],
  "ingredients": {
    "bundle": "./data/exams/food/ingredients_data.4f53cda1.js",
    "global": "INGREDIENTS_DATA",
    "contentHash": "4f53cda1",
    "stats": {
      "count": 0
    }
  },
  "integratedExam": {
    "questionsPerSubject": {
      "sanitation": 8
    },
    "examTimeMin": 15,
    "passAverage": 60,
    "subjectFailBelow": 40
  },
  "uiText": {
    "dictionary": {
      "title": "지식DB 사전",
      "subtitle": "엔티티 검색 (파일럿 — 지식DB 미탑재)"
    }
  }
};
if (typeof window !== 'undefined') {
  window.DATA_REGISTRY_FOOD = DATA_REGISTRY_FOOD;
}
