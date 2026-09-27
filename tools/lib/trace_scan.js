/**
 * trace_scan.js — SPEC ID 추적 스캔 공용 모듈
 *
 * build_trace_matrix.js·impact_tests.js·trace.js가 공유하는 스캔 원천.
 * 스캔 범위·토큰 규격은 check_spec_refs.js와 동일하게 유지한다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_FILE = path.join(ROOT, 'docs', 'dev', 'SPEC.md');

// @spec 스캔 범위 (check_spec_refs.js와 동일)
const SCAN_DIRS = ['src', 'tests', 'tools', 'css', 'ref-pipeline'];
const SCAN_FILES = ['sw.js', 'index.html', 'serve.js'];
const SCAN_EXTS = new Set(['.js', '.css', '.html', '.ts', '.py']);
const EXCLUDE_DIRS = [path.join('tools', '_archive'), path.join('tools', '__pycache__'), 'node_modules'];
const EXCLUDE_FILES = [
  path.join('tools', 'check_spec_refs.js'),
  path.join('tools', 'build_trace_matrix.js'),
  path.join('tools', 'impact_tests.js'),
  path.join('tools', 'trace.js'),
  path.join('tools', 'lib', 'trace_scan.js'),
];

// 문서 스캔 범위 (check_doc_ids.js와 동일)
const DOC_DIRS = ['docs', 'ref-pipeline'];
const DOC_FILES = ['AGENTS.md', 'README.md'];
const REPORT_DIR = 'docs/report_archive';

const ID_RE = /\b([A-Z]{1,4}(?:-[A-Z]{1,4})?-(?:\d{2}|P\d))\b/g;
const SPEC_TAG_RE = /@spec\s+([^\n]*)/g;
const RANGE_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-P?)(\d{1,2})~P?(\d{1,2})$/;
const WILDCARD_ID_RE = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?)-\*$/;
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

/** @spec·관련 SPEC ID 토큰 → ID 집합 (범위·나열·접두사 와일드카드) */
function expandIds(tagText, specIds = new Set()) {
  const ids = new Set();
  if (/^(none\b|해당|전 영역)/.test(tagText.trim())) return ids;
  for (const raw of tagText.split(/[,·]/)) {
    const token = raw.trim()
      .replace(/\*\/\s*$/, '')
      .replace(/-->\s*$/, '')
      .replace(/[)）(].*$/, '')
      .replace(/[가-힣\s].*$/, '')
      .replace(/[`'"]/g, '')
      .trim();
    if (!token) continue;
    if (/^none\b/i.test(token)) return ids;
    const range = token.match(RANGE_RE);
    if (range) {
      const [, prefix, from, to] = range;
      const pad = prefix.endsWith('P') ? 1 : 2; // ROAD-P0~P4는 단자리
      for (let i = +from; i <= +to; i++) ids.add(prefix + String(i).padStart(pad, '0'));
      continue;
    }
    const wild = token.match(WILDCARD_ID_RE);
    if (wild) {
      const keys = specIds instanceof Map ? specIds.keys() : specIds;
      for (const id of keys) if (id.startsWith(wild[1] + '-')) ids.add(id);
      continue;
    }
    if (PURE_ID_RE.test(token)) ids.add(token);
  }
  return ids;
}

/** SPEC.md → Map(id → 절 제목) */
function extractSpec() {
  const lines = fs.readFileSync(SPEC_FILE, 'utf8').split('\n');
  const ids = new Map();
  let sec = '';
  for (const l of lines) {
    if (/^#{2,3} /.test(l)) sec = l.replace(/^#+\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    for (const m of l.matchAll(ID_RE)) {
      if (m[1].startsWith('DOC-')) continue;
      // 절 이전(버전 헤더 등) 언급은 빈 절로 등록 — 실제 선언 절을 만나면 갱신
      if (!ids.has(m[1]) || (!ids.get(m[1]) && sec)) ids.set(m[1], sec);
    }
  }
  return ids;
}

/** 코드 @spec 스캔 → { src: Map(id→Set(file)), tst: Map(id→Set(file)) } */
function collectCodeRefs(specIds) {
  const src = new Map(), tst = new Map();
  const files = [...SCAN_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f))];
  for (const d of SCAN_DIRS) files.push(...walk(path.join(ROOT, d), SCAN_EXTS));
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const isTest = rel.startsWith('tests/');
    fs.readFileSync(file, 'utf8').split('\n').forEach(text => {
      for (const m of text.matchAll(SPEC_TAG_RE)) {
        for (const id of expandIds(m[1], specIds)) {
          const map = isTest ? tst : src;
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(rel);
        }
      }
    });
  }
  return { src, tst };
}

/** 문서 스캔 → { docs, reports: Map(specId→Set(docId)), meta: Map(docId→{file,title}), missingRef: [file] } */
function collectDocRefs(specIds) {
  const docs = new Map(), reports = new Map();
  const meta = new Map();
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
    const map = rel.startsWith(REPORT_DIR) ? reports : docs;
    for (const id of expandIds(m[1], specIds)) {
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(docId);
    }
  }
  return { docs, reports, meta, missingRef };
}

/** 단일 파일의 관련 ID 직접 추출 (@spec 또는 문서 헤더) */
function idsInFile(absPath, specIds) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const text = fs.readFileSync(absPath, 'utf8');
  const ids = new Set();
  if (rel.endsWith('.md')) {
    const m = text.match(RELATED_RE);
    if (m) for (const id of expandIds(m[1], specIds)) ids.add(id);
    return ids;
  }
  for (const m of text.matchAll(SPEC_TAG_RE)) {
    for (const id of expandIds(m[1], specIds)) ids.add(id);
  }
  return ids;
}

/** 전체 추적 데이터 한 번에 수집 (도구 공용 진입점) */
function scanAll() {
  const specIds = extractSpec();
  const { src, tst } = collectCodeRefs(specIds);
  const { docs, reports, meta, missingRef } = collectDocRefs(specIds);
  return { specIds, src, tst, docs, reports, meta, missingRef };
}

module.exports = {
  ROOT, SPEC_FILE, SCAN_DIRS, SCAN_FILES, SCAN_EXTS, DOC_DIRS, DOC_FILES, REPORT_DIR,
  ID_RE, DOC_ID_RE, RELATED_RE,
  walk, expandIds, extractSpec, collectCodeRefs, collectDocRefs, idsInFile, scanAll,
};
