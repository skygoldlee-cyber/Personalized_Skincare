// data/release-notes.js — 사용자용 변경 이력 (최신순)
// 형식: { version: 'v000-YYYYMMDD-hash', date: 'YYYY-MM-DD', notes: ['...'] }
// 작성 워크플로: `npm run notes:draft` → pending 항목 자동 초안(커밋 subject 기반)
//   → 수동 편집 → `npm run deploy` 시 pending 항목에 실제 버전 부여.
// pending 항목 없이 배포하면 커밋 subject가 그대로 노트가 되므로 배포 전 편집 권장.
window.RELEASE_NOTES = [
  {
    pending: true,
    date: '2026-09-26',
    notes: [
      '새 버전 적용 시 "무엇이 바뀌었는지" 알려주는 변경 이력 알림 추가 (설정 메뉴에서도 열람 가능)',
      '사이드바·설정 메뉴의 버전 표시가 실제 배포 버전과 일치하도록 수정',
    ],
  },
  {
    version: 'v369-20260926-346691b',
    date: '2026-09-26',
    notes: [
      '저장 안정성 강화 — 데이터 저장 실패 시 자동 복구·경고',
      '수치 훈련 정답 표시 오류 수정',
      '모의고사·퀴즈 약점 항목 조회 속도 개선',
    ],
  },
];
