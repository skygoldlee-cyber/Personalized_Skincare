// tests/fixtures/sample-questions.js
// @spec DR-07
// 문항 스키마 검증용 샘플 문항 — 화장품 시험 도메인 내용을 담고 있어
// 플랫폼 모듈(src/questions.js)이 아닌 테스트 픽스처로 분리됨.
// (내용/수치는 예시 — 식약처 가이드로 검증된 실제 문항이 아님)

export const SAMPLE_QUESTIONS = [
  {
    id: 'q-01-001', subject: 1, type: 'single', points: 4,
    stem: '화장품법상 영업의 종류에 해당하지 않는 것은?',
    options: [
      // "옳지 않은 것은?"형 — correct 보기(4번)만 거짓 명제, 나머지는 참 명제.
      // truth가 있으면 이 문항의 보기 5개를 그대로 O/X 드릴로 펼칠 수 있다.
      { id: '1', text: '화장품제조업', truth: true },
      { id: '2', text: '화장품책임판매업', truth: true },
      { id: '3', text: '맞춤형화장품판매업', truth: true },
      { id: '4', text: '화장품수출대행업', correct: true, truth: false,
        explain: '법정 영업 3종에 없음' },
      { id: '5', text: '화장품판매업', truth: false,
        explain: "'판매업'이라는 명칭의 영업은 없음" },
    ],
    answer: '4',
    tags: ['정의'],
    explain: '화장품법상 영업은 제조업·책임판매업·맞춤형화장품판매업 3종. (예시)',
  },
  {
    id: 'q-04-137', subject: 4, type: 'combo', points: 8,
    citation: '📖 화장품법 제3조의2 (예시 출처)',
    stem: '맞춤형화장품 혼합·소분에 관한 설명으로 옳은 것을 모두 고른 것은?',
    statements: [
      { id: 'ㄱ', sid: 'st-04-0001', conceptId: '혼합소분범위',
        text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄴ', sid: 'st-04-0002', conceptId: '신고주체',
        text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
      { id: 'ㄷ', sid: 'st-04-0003', conceptId: '혼합소분범위',
        text: '(옳은 진술 예시)', truth: true,  explain: '근거: … (예시)' },
      { id: 'ㄹ', sid: 'st-04-0004', conceptId: '신고주체',
        text: '(틀린 진술 예시)', truth: false, explain: '실제로는 … (예시)' },
    ],
    options: [
      { id: '1', members: ['ㄱ', 'ㄴ'] },
      { id: '2', members: ['ㄱ', 'ㄷ'] },       // ← 도출 정답
      { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
      { id: '4', members: ['ㄱ', 'ㄷ', 'ㄹ'] },
      { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
    ],
    // answer는 생략 가능(도출됨). 넣으면 validateQuestion이 일치 검증.
    answer: '2',
    tags: ['절차'],
  },
  {
    id: 'q-04-137-ox2', subject: 4, type: 'ox', points: 2,
    stem: '다음 진술의 참/거짓을 판정하시오.',
    statement: '(q-04-137의 ㄴ 진술과 동일한 텍스트 — O/X 드릴 자동 생성 산출물)',
    truth: false,
    derivedFrom: 'q-04-137#ㄴ',
    explain: '실제로는 … (예시)',
    tags: ['절차'],
  },
  {
    id: 'q-04-201', subject: 4, type: 'short', points: 12.5,
    stem: '천연보습인자(NMF)의 구성 성분 중 가장 큰 비중을 차지하는 물질은?',
    accept: ['아미노산', 'amino acid', 'aminoacid'],
    explain: 'NMF의 약 40%가 아미노산. (예시 — 수치 검증 필요)',
    tags: ['구성비'],
  },
];
