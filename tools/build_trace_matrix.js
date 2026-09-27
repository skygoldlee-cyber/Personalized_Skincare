#!/usr/bin/env node
/**
 * build_trace_matrix.js — TRACE MATRIX 자동 생성
 *
 * SPEC.md의 요구사양 ID를 축으로, 4계층 추적 링크를 수집해
 * docs/dev/TRACE_MATRIX.md를 생성한다 (생성물 — 직접 편집 금지).
 *
 *   요구사양 (SPEC.md) ─┬─ 문서   : 각 .md 헤더의 "관련 SPEC ID" 행
 *                     ├─ 소스   : src/·css/·tools/·ref-pipeline/ 의 @spec 태그
 *                     ├─ 테스트 : tests/ 의 @spec 태그
 *                     └─ 보고서 : docs/report_archive/ 의 관련 SPEC ID
 *
 * 사용법:
 *   npm.cmd run build:trace            # TRACE_MATRIX.md 재생성
 *   node tools/build_trace_matrix.js   # 직접 실행
 *
 * @spec 태그 규격·스캔 범위는 check_spec_refs.js와 동일 — 양쪽이 같은 진실을 본다.
 */

// @spec none (추적 매트릭스 생성 도구)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPEC_FILE = path.join(ROOT, 'docs', 'dev', 'SPEC.md');
const OUT_FILE = path.join(ROOT, 'docs', 'dev', 'TRACE_MATRIX.md');

// ── @spec 스캔 범위 (check_spec_refs.js와 동일) ──────────────────
const SCAN_DIRS = ['src', 'tests', 'tools', 'css', 'ref-pipeline'];
const SCAN_FILES = ['sw.js', 'index.html', 'serve.js'];
const SCAN_EXTS = new Set(['.js', '.css', '.html', '.ts', '.py']);
const EXCLUDE_DIRS = [path.join('tools', '_archive'), path.join('tools', '__pycache__'), 'node_modules'];
const EXCLUDE_FILES = [
  path.join('tools', 'check_spec_refs.js'),
  path.join('tools', 'build_trace_matrix.js'), // 자기 자신 제외
];

// 문서 스캔 범위 (check_doc_ids.js와 동일)
const DOC_DIRS = ['docs', 'ref-pipeline'];
const DOC_FILES = ['AGENTS.md', 'README.md'];
const REPORT_DIR = path.join('docs', 'report_archive');

const ID_RE = /\b([A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}|P\d))\b/g;
const SPEC_TAG_RE = /@spec\s+([^\n]*)/g;
const RANGE_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-)(\d{2})~(\d{2})$/;
const PURE_ID_RE = /^[A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}|P\d)$/;
const DOC_ID_RE = /\*\*문서 ID\*\*:\s*(DOC-[A-Z]+-\d+)/;
const RELATED_RE = /^>\s*\*\*관련 SPEC ID\*\*:\s*(.+)$/m;

function* walk(dir, exts) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) continue;
      const rel = path.relative(ROOT, p);
      if (EXCLUDE_DIRS.some(x => rel === x || rel.startsWith(x + path.sep))) continue;
      yield* walk(p, exts);
    } else if (exts.has(path.extname(e.name))) {
      const rel = path.relative(ROOT, p);
      if (!EXCLUDE_FILES.some(x => rel === x)) yield p;
    }
  }
}

/** @spec 토큰 → ID 집합 (범위·나열 — check_spec_refs.js와 동일 규칙) */
function expandIds(tagText) {
  const ids = new Set();
  for (const raw of tagText.split(/[,·]/)) {
    const token = raw.trim()
      .replace(/\*\/\s*$/, '')
      .replace(/-->\s*$/, '')
      .replace(/[)（(].*$/, '')
      .replace(/[가-힣\s].*$/, '')
      .replace(/[`'"]/g, '')           // 백틱·인용부호 제거 (`FO-01~23` 형태)
      .trim();
    if (!token || /^none\b/i.test(token) || /^해당/.test(raw.trim())) continue;
    const range = token.match(RANGE_RE);
    if (range) {
      const [, prefix, from, to] = range;
      for (let i = +from; i <= +to; i++) ids.add(prefix + String(i).padStart(2, '0'));
      continue;
    }
    if (PURE_ID_RE.test(token)) ids.add(token);
  }
  return ids;
}

/** SPEC.md → 선언 ID + 절 위치 */
function extractSpec() {
  const lines = fs.readFileSync(SPEC_FILE, 'utf8').split('\n');
  const ids = new Map(); // id → section
  let sec = '';
  for (const l of lines) {
    if (/^#{2,3} /.test(l)) sec = l.replace(/^#+\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    for (const m of l.matchAll(ID_RE)) {
      if (!m[1].startsWith('DOC-') && !ids.has(m[1])) ids.set(m[1], sec);
    }
  }
  return ids;
}

/** 코드 @spec 스캔 → id → {src: Set, test: Set} */
function collectCodeRefs() {
  const src = new Map(), tst = new Map(); // id → Set(file)
  const files = [...SCAN_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f))];
  for (const d of SCAN_DIRS) files.push(...walk(path.join(ROOT, d), SCAN_EXTS));
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const isTest = rel.startsWith('tests/');
    fs.readFileSync(file, 'utf8').split('\n').forEach(text => {
      for (const m of text.matchAll(SPEC_TAG_RE)) {
        for (const id of expandIds(m[1])) {
          const map = isTest ? tst : src;
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(rel);
        }
      }
    });
  }
  return { src, tst };
}

/** 문서 스캔 → id → {docs: Set(DOC-ID), reports: Set(DOC-ID)}, + 문서 메타 */
function collectDocRefs() {
  const docs = new Map(), reports = new Map(); // specId → Set(DOC-ID)
  const meta = new Map(); // docId → {file, title}
  const missingRef = [];
  const files = DOC_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f));
  for (const d of DOC_DIRS) files.push(...walk(path.join(ROOT, d), new Set(['.md'])));
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const docId = (text.match(DOC_ID_RE) || [])[1] || rel;
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || rel;
    meta.set(docId, { file: rel, title });
    const m = text.match(RELATED_RE);
    if (!m) { missingRef.push(rel); continue; }
    const isReport = rel.startsWith(REPORT_DIR.replace(/\\/g, '/'));
    const map = isReport ? reports : docs;
    for (const id of expandIds(m[1])) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(docId);
    }
  }
  return { docs, reports, meta, missingRef };
}

function main() {
  const specIds = extractSpec();
  const { src, tst } = collectCodeRefs();
  const { docs, reports, meta, missingRef } = collectDocRefs();

  // 절별 그룹핑
  const bySection = new Map();
  for (const [id, sec] of specIds) {
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec).push(id);
  }

  const out = [];
  out.push('# 🔗 TRACE MATRIX — 요구사양 추적 매트릭스', '');
  out.push('> **문서 ID**: DOC-DEV-04');
  out.push('> **관련 SPEC ID**: 해당 없음 (본 문서가 추적 산출물)');
  out.push('> ⚠️ 자동 생성 파일 — `npm run build:trace`로 재생성. 직접 편집 금지.');
  out.push(`> 생성: ${new Date().toISOString().slice(0, 10)} · 원천: SPEC.md(${specIds.size}개 ID) + @spec 태그 + 문서 헤더`, '');
  out.push('| 열 | 의미 | 원천 |');
  out.push('|----|------|------|');
  out.push('| 문서 | 해당 요구사항을 다루는 문서 (DOC-ID) | 각 문서 헤더 "관련 SPEC ID" |');
  out.push('| 소스 | 구현 코드 파일 | `// @spec` 태그 |');
  out.push('| 테스트 | 검증 테스트 파일 | `// @spec` 태그 (tests/) |');
  out.push('| 보고서 | 분석·결과 보고서 | report_archive 헤더 |');
  out.push('');

  // 요약 통계
  let nDoc = 0, nSrc = 0, nTst = 0, nRpt = 0;
  for (const id of specIds.keys()) {
    if (docs.has(id)) nDoc++;
    if (src.has(id)) nSrc++;
    if (tst.has(id)) nTst++;
    if (reports.has(id)) nRpt++;
  }
  out.push(`**커버리지 요약**: 요구사항 ${specIds.size}개 — 문서 연결 ${nDoc} · 소스 연결 ${nSrc} · 테스트 연결 ${nTst} · 보고서 연결 ${nRpt}`, '');
  out.push('---', '');

  const fmt = set => set ? [...set].sort().join('<br>') : '—';

  for (const [sec, ids] of bySection) {
    out.push(`## ${sec || '기타 (SPEC 헤더·본문 언급)'}`, '');
    out.push('| ID | 문서 | 소스 | 테스트 | 보고서 |');
    out.push('|----|------|------|--------|--------|');
    for (const id of ids.sort()) {
      const cell = (m) => {
        const s = m.get(id);
        if (!s) return '—';
        const arr = [...s].sort();
        return arr.length > 4 ? arr.slice(0, 4).join('<br>') + `<br>…외 ${arr.length - 4}개` : arr.join('<br>');
      };
      out.push(`| ${id} | ${cell(docs)} | ${cell(src)} | ${cell(tst)} | ${cell(reports)} |`);
    }
    out.push('');
  }

  // 부록: 문서 ↔ SPEC 역방향 (문서 ID 기준)
  out.push('---', '', '## 부록 A — 문서 → 요구사양 역방향 매핑', '');
  out.push('| 문서 ID | 파일 | 관련 SPEC ID |');
  out.push('|---------|------|--------------|');
  const docToSpec = new Map();
  for (const [id, set] of [...docs, ...reports]) {
    for (const d of set) {
      if (!docToSpec.has(d)) docToSpec.set(d, new Set());
      docToSpec.get(d).add(id);
    }
  }
  for (const [docId, info] of [...meta].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ids = docToSpec.get(docId);
    out.push(`| ${docId} | ${info.file} | ${ids ? [...ids].sort().join(', ') : '—'} |`);
  }
  if (missingRef.length) {
    out.push('', '## 부록 B — 관련 SPEC ID 헤더 누락 문서', '');
    for (const f of missingRef) out.push(`- ${f}`);
  }
  out.push('');

  fs.writeFileSync(OUT_FILE, out.join('\n'));
  console.log(`✅ TRACE_MATRIX.md 생성 — 요구사항 ${specIds.size}개 · 문서 ${nDoc} · 소스 ${nSrc} · 테스트 ${nTst} · 보고서 ${nRpt} 연결`);
  if (missingRef.length) console.log(`⚠ 관련 SPEC ID 헤더 누락 ${missingRef.length}개 문서 (부록 B 참조)`);
}

main();
