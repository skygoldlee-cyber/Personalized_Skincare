const fs = require('fs');
const path = require('path');

function checkStatsAnomaly(statsFile, currentStats, logger) {
  if (!fs.existsSync(statsFile)) {
    // Save current stats for next time
    fs.writeFileSync(statsFile, JSON.stringify(currentStats, null, 2), 'utf-8');
    return;
  }

  try {
    const prevStats = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
    
    // Compare textbook card counts
    Object.keys(currentStats.subjects).forEach(key => {
      const prev = prevStats.subjects[key];
      const curr = currentStats.subjects[key];
      if (prev && curr) {
        if (curr.cards < prev.cards * 0.8) {
          logger.warn(`[WARN] Subject "${key}" cards decreased significantly! Prev: ${prev.cards}, Curr: ${curr.cards} (>=20% loss)`);
        }
        if (curr.quizzes < prev.quizzes * 0.8) {
          logger.warn(`[WARN] Subject "${key}" quizzes decreased significantly! Prev: ${prev.quizzes}, Curr: ${curr.quizzes} (>=20% loss)`);
        }
      }
      // 파일 단위 diff — 과목 합계 20% 미만의 소규모 무소음 드롭 탐지
      const prevFiles = (prev && prev.files) || {};
      const currFiles = curr.files || {};
      for (const [f, p] of Object.entries(prevFiles)) {
        const c = currFiles[f];
        if (!c) {
          logger.warn(`[WARN] Subject "${key}": 교재 파일이 빌드에서 사라짐: ${f} (이전 카드 ${p.cards})`);
        } else if (c.cards === 0 && p.cards > 0) {
          logger.warn(`[WARN] Subject "${key}": "${f}" 카드 ${p.cards} → 0 — 파서 계약/섹션 스킵 확인 필요`);
        } else if (c.cards < p.cards * 0.8) {
          logger.warn(`[WARN] Subject "${key}": "${f}" 카드 감소 ${p.cards} → ${c.cards} (>=20% loss)`);
        }
      }
      for (const [f, c] of Object.entries(currFiles)) {
        if (!(f in prevFiles) && c.cards === 0) {
          logger.warn(`[WARN] Subject "${key}": "${f}" 카드 0건 (신규) — 파서 계약 확인 필요`);
        }
      }
    });

    // Compare exam question counts
    Object.keys(currentStats.exams).forEach(key => {
      const prev = prevStats.exams[key];
      const curr = currentStats.exams[key];
      if (prev && curr) {
        if (curr.questions < prev.questions * 0.8) {
          logger.warn(`[WARN] Exam "${key}" questions decreased significantly! Prev: ${prev.questions}, Curr: ${curr.questions} (>=20% loss)`);
        }
      }
    });
  } catch (e) {
    logger.error('Error comparing statistics:', e);
  }

  // Save current stats
  fs.writeFileSync(statsFile, JSON.stringify(currentStats, null, 2), 'utf-8');
}

/**
 * #3 마커 감시 리포트 (MODULAR_DESIGN 5-3).
 * 🔖기출 마커가 있으나 퀴즈가 생성되지 않은 항목을 빌드 로그에 경고로 출력한다.
 * (빌드를 실패시키지는 않음 — 조용한 손실을 "보이게" 만드는 것이 목적)
 *
 * @param {Array<{subject:string, files:Array<{file:string,count:number,samples:string[]}>}>} warnings
 */
function printMarkerWarnings(warnings, logger) {
  if (!warnings || warnings.length === 0) return;

  let total = 0;
  warnings.forEach(w => w.files.forEach(f => { total += f.count; }));
  logger.warn(`\n[마커 감시] 🔖기출 표시가 있으나 퀴즈 미생성 — 총 ${total}건`);

  warnings.forEach(w => {
    w.files.forEach(f => {
      logger.warn(`[WARN] ${f.file}: 🔖기출 마커가 있으나 퀴즈 미생성 — ${f.count}건`);
      const samples = f.samples || [];
      samples.slice(0, 10).forEach(s => {
        const text = typeof s === 'object' ? s.text : s;
        const line = typeof s === 'object' && s.line ? `L${s.line} ` : '';
        const snippet = text.length > 40 ? text.substring(0, 40) + '…' : text;
        logger.warn(`  - ${line}"${snippet}"`);
      });
      if (samples.length > 10) {
        logger.warn(`  … 외 ${samples.length - 10}건`);
      }
    });
  });
}

module.exports = {
  checkStatsAnomaly,
  printMarkerWarnings
};
