// tests/unit/audit-quality.test.js — 콘텐츠 품질 감사 스크립트 통합 테스트
// @spec CQ-01,CQ-02,CQ-03,CQ-04,CQ-05
// audit_card_quality.js/audit_combo.js를 실제 실행해
// 감사 카테고리·심각도 분류·요약 리포트·exit 코드를 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function runAudit(script) {
  return execFileSync('node', [`tools/check/${script}`], {
    cwd: ROOT, encoding: 'utf-8', timeout: 120000,
  });
}

// ---------- CQ-01~04: 카드 품질 감사 ----------

test('CQ-01/CQ-03: audit:cards가 카드 품질 감사를 실행하고 총 카드 수를 보고한다', () => {
  const out = runAudit('audit_card_quality.js');
  assert.ok(out.includes('카드 품질 감사'), '감사 섹션 출력');
  assert.match(out, /총 카드: \d+장/, '카드 수 집계');
  const m = out.match(/총 카드: (\d+)장/);
  assert.ok(Number(m[1]) > 500, '실제 카드 데이터를 감사해야 함');
});

test('CQ-02: 참조자료 링크 유효성 감사 섹션이 보고된다', () => {
  const out = runAudit('audit_card_quality.js');
  assert.ok(out.includes('참조자료 링크 감사'), '링크 감사 섹션 출력');
  assert.match(out, /링크 이슈: \d+건/, '링크 이슈 집계');
});

test('CQ-04: 오류/경고 심각도 분류와 요약 리포트를 출력한다', () => {
  const out = runAudit('audit_card_quality.js');
  assert.match(out, /오류: \d+건, 경고: \d+건/, '심각도 분류');
  assert.ok(out.includes('=== 요약 ==='), '요약 리포트');
});

// ---------- CQ-05: 복수정답형 품질 감사 ----------

test('CQ-05: audit:combo가 과목별 문항 수와 정답 위치 분포를 보고한다', () => {
  const out = runAudit('audit_combo.js');
  assert.match(out, /combo_subject\d+\.js: \d+문/, '과목별 문항 집계');
  assert.ok(out.includes('정답위치'), '정답 위치 편향 히스토그램');
  assert.match(out, /결과: 오류 \d+건 \/ 경고 \d+건/, '심각도 분류 요약');
});

test('CQ-05: audit:combo가 오류 없이 통과한다 (배포 게이트 기준)', () => {
  const out = runAudit('audit_combo.js');
  assert.ok(out.includes('✅'), '통과 마커');
  assert.ok(!/결과: 오류 [1-9]/.test(out), '오류가 있으면 exit 1이어야 함');
});

test('CQ-05: 회귀 기준선 combo_baseline.json이 과목별 문항 수를 기록한다', () => {
  const p = join(ROOT, 'combo_baseline.json');
  assert.ok(existsSync(p), 'baseline 파일 존재');
  const baseline = JSON.parse(readFileSync(p, 'utf-8'));
  const exam = baseline.cosmetic || Object.values(baseline)[0] || {};
  const keys = Object.keys(exam);
  assert.ok(keys.length >= 4, '과목별 기준선 엔트리');
  for (const v of Object.values(exam)) {
    assert.ok(typeof v === 'number' && v > 0, '문항 수는 양수');
  }
});
