#!/usr/bin/env node
/**
 * build_id_migration.js — 콘텐츠 갱신으로 바뀐 카드/퀴즈 ID의 이관 맵 생성
 *
 * 카드/퀴즈 ID는 stableId(subjectKey, chapterKey, type, term) — 교재 교체로
 * term 해시가 달라지면 기존 진도(localStorage memorized/weak/quizResults)가
 * 고아가 되어 cleanOrphansForSubject가 삭제한다.
 *
 * 동작:
 *   1. 직전 빌드의 스냅샷 {dataRoot}/card_terms_snapshot.json 로드
 *      (없으면 첫 실행 — 빈 맵 출력 후 스냅샷만 기록)
 *   2. 현재 content를 plugin.build()로 파싱해 신규 ID 산출
 *   3. 과목 내에서 term(카드) / 정규화된 question|answer(퀴즈)가
 *      유일하게 일치하면 구ID → 신ID 매핑
 *   4. {dataRoot}/id_migration.js (window.ID_MIGRATION_MAP) 출력 +
 *      스냅샷을 신규 값으로 갱신
 *
 * 스냅샷은 커밋 대상 — 배포된 직전 빌드의 ID 집합을 보존한다.
 * 매칭이 모호한 항목(동일 term의 신규 카드가 2개 이상)은 매핑하지 않는다.
 *
 * 실행: node tools/build/build_id_migration.js   (npm run build:id-migration / build:data 체인 말미)
 */
const fs = require('fs');
const path = require('path');
const plugin = require('./plugins/textbook.plugin.js');
const idFactory = require('./id-factory.js');
const { getExamTargets } = require('./exam-targets.js');

const ROOT = path.resolve(__dirname, '..', '..');
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

function buildForTarget(target) {
  const dataDir = path.join(ROOT, target.dataRoot);
  const snapPath = path.join(dataDir, 'card_terms_snapshot.json');
  const prev = fs.existsSync(snapPath)
    ? JSON.parse(fs.readFileSync(snapPath, 'utf-8'))
    : {};

  // 1) 현재 콘텐츠 파싱 → 신규 스냅샷 + term→id 역인덱스
  const cur = {};           // subjectKey → {cards:{id:term}, quizzes:{id:key}}
  const newCardByTerm = {}; // subjectKey → Map(term → [id])
  const newQuizByKey = {};
  for (const subject of target.manifest.subjects || []) {
    const data = plugin.build(subject, {
      workspaceDir: ROOT, idFactory,
      contentRoot: target.contentRoot, dataRoot: target.dataRoot
    });
    const bucket = { cards: {}, quizzes: {} };
    const cIdx = new Map(), qIdx = new Map();
    for (const c of data.cards || []) {
      const t = norm(c.term);
      bucket.cards[c.id] = t;
      if (!cIdx.has(t)) cIdx.set(t, []);
      cIdx.get(t).push(c.id);
    }
    for (const q of data.quizzes || []) {
      const k = `${norm(q.question)}|${norm(q.answer)}`;
      bucket.quizzes[q.id] = k;
      if (!qIdx.has(k)) qIdx.set(k, []);
      qIdx.get(k).push(q.id);
    }
    cur[subject.key] = bucket;
    newCardByTerm[subject.key] = cIdx;
    newQuizByKey[subject.key] = qIdx;
  }

  // 2) 구 스냅샷 대비 ID 이관 맵 생성 (같은 과목 내 유일 매칭만)
  const map = {};
  let moved = 0, lost = 0;
  for (const [subjKey, prevBucket] of Object.entries(prev)) {
    const curBucket = cur[subjKey];
    if (!curBucket) continue; // 과목 자체가 사라짐 — 이관 대상 없음
    const apply = (prevIds, idx, curIds) => {
      for (const [oldId, key] of Object.entries(prevIds)) {
        if (curIds[oldId]) continue;                    // ID 불변 — 이관 불필요
        const cands = (idx.get(key) || []).filter(id => id !== oldId);
        if (cands.length === 1) { map[oldId] = cands[0]; moved++; }
        else lost++;
      }
    };
    apply(prevBucket.cards || {}, newCardByTerm[subjKey], curBucket.cards);
    apply(prevBucket.quizzes || {}, newQuizByKey[subjKey], curBucket.quizzes);
  }

  // 3) 산출: 이관 맵 번들 + 스냅샷 갱신
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'id_migration.js'),
    '// 자동 생성된 ID 마이그레이션 맵입니다. 수정하지 마십시오. (tools/build/build_id_migration.js)\n' +
    `var ID_MIGRATION_MAP = ${JSON.stringify(map)};\n` +
    'if (typeof window !== "undefined") window.ID_MIGRATION_MAP = ID_MIGRATION_MAP;\n',
    'utf-8'
  );
  fs.writeFileSync(snapPath, JSON.stringify(cur, null, 1), 'utf-8');
  console.log(
    `[id-migration] ${target.id}: 이관 ${moved}건 · 미이관(삭제) ${lost}건 · ` +
    `스냅샷 갱신 ${Object.keys(cur).length}과목 → ${target.dataRoot}/id_migration.js`
  );
}

for (const target of getExamTargets(ROOT)) {
  if (target.manifest) buildForTarget(target);
}
