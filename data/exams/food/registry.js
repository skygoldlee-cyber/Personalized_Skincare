// 자동 생성된 데이터 레지스트리 파일입니다. 수정하지 마십시오.
var DATA_REGISTRY_FOOD = {
  "schemaVersion": 1,
  "contentYear": "2027",
  "generatedAt": "2026-10-01T05:57:11.920Z",
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
      "file": "과목1_문제은행.md",
      "bundle": "./data/exams/food/exams/subject1.df1fe251.js",
      "global": "EXAM_DATA_subject1",
      "contentHash": "df1fe251",
      "stats": {
        "questions": 8
      }
    }
  ],
  "additives": {
    "bundle": "./data/exams/food/additives_data.5274f63a.js",
    "global": "ADDITIVES_DATA",
    "contentHash": "5274f63a",
    "version": "0.1.0",
    "updatedAt": "2026-09-30",
    "notice": "Phase D 파일럿 — 식품첨가물공전 기준 발췌 데이터. 정확한 사용기준 수치는 공전 원문을 확인하세요.",
    "history": [],
    "stats": {
      "count": 12
    }
  },
  "knowledge": {
    "registryKey": "additives",
    "global": "ADDITIVES_DATA",
    "source": {
      "type": "json"
    },
    "entityUnit": "첨가물",
    "filterField": "useCategory",
    "fields": {
      "title": "name",
      "subtitle": "engName",
      "subtitleEmpty": "영문명 없음",
      "search": [
        "name",
        "engName",
        "purpose",
        "useLimit"
      ],
      "chosungField": "name"
    },
    "badge": {
      "field": "useCategory",
      "defaultLabel": "기타",
      "labels": {
        "preservative": "보존료",
        "sweetener": "감미료",
        "colorant": "착색료",
        "colorFixative": "발색제",
        "antioxidant": "산화방지제",
        "flavorEnhancer": "향미증진제"
      }
    },
    "filters": [
      {
        "key": "all",
        "label": "전체 첨가물"
      },
      {
        "key": "preservative",
        "label": "보존료",
        "icon": "fa-shield-halved",
        "color": "var(--color-success)"
      },
      {
        "key": "sweetener",
        "label": "감미료",
        "icon": "fa-cubes",
        "color": "var(--color-warning)"
      },
      {
        "key": "colorant",
        "label": "착색료",
        "icon": "fa-palette",
        "color": "var(--color-danger)"
      },
      {
        "key": "colorFixative",
        "label": "발색제"
      },
      {
        "key": "antioxidant",
        "label": "산화방지제"
      },
      {
        "key": "flavorEnhancer",
        "label": "향미증진제"
      }
    ],
    "details": [
      {
        "key": "purpose",
        "label": "용도",
        "empty": "-"
      },
      {
        "key": "useLimit",
        "label": "사용기준",
        "empty": "공전 사용기준표 참조",
        "wide": true
      },
      {
        "key": "lawRef",
        "label": "근거",
        "empty": "식품첨가물공전",
        "wide": true
      },
      {
        "key": "note",
        "label": "TIP",
        "tip": true
      }
    ],
    "csv": {
      "filename": "additives",
      "headers": [
        "첨가물명",
        "영문명",
        "용도",
        "분류",
        "사용기준",
        "근거",
        "비고"
      ],
      "fields": [
        "name",
        "engName",
        "purpose",
        {
          "badgeLabel": "useCategory"
        },
        "useLimit",
        "lawRef",
        "note"
      ]
    },
    "header": {
      "title": "식품첨가물 사전",
      "subtitle": "지정 식품첨가물 검색 — 식품첨가물공전 기준 (파일럿 12종)",
      "searchPlaceholder": "첨가물명·영문명·용도 검색 (예: 소르빈, sorbic, 보존료)"
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
      "title": "식품첨가물 사전",
      "subtitle": "지정 식품첨가물 검색 — 식품첨가물공전 기준 (파일럿 12종)"
    }
  }
};
if (typeof window !== 'undefined') {
  window.DATA_REGISTRY_FOOD = DATA_REGISTRY_FOOD;
}
