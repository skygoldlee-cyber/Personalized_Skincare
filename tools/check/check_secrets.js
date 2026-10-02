#!/usr/bin/env node
/**
 * check_secrets.js — 커밋된 파일의 시크릿 패턴 스캔
 *
 * git 추적 파일 전수를 대상으로 알려진 비밀키 패턴을 탐지한다.
 *   - 개인키 블록(-----BEGIN ... PRIVATE KEY-----)
 *   - Supabase Secret/service_role 키 (sb_secret_*, JWT role 서명 패턴)
 *   - AWS/GCP/GitHub/Slack 등 범용 토큰 접두사
 *   - `password|secret|api_key = "…"` 형태의 하드코딩 대입
 *
 * 공개 설계상 허용되는 값(src/supabase-config.js의 Publishable key 등)은
 * ALLOWLIST에 명시한다. 오탐 추가 시 패턴보다 파일 경로로 면제할 것.
 *
 * 사용법:
 *   npm.cmd run check:secrets        # 전수 스캔
 */

// @spec none (보안 검증)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const PATTERNS = [
  { re: /-{5}BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY/, label: '개인키 블록' },
  { re: /\bsb_secret_[A-Za-z0-9_-]+/, label: 'Supabase Secret key' },
  { re: /\bservice_role["'\s]*[:=]\s*['"]?[A-Za-z0-9._-]{15,}/i, label: 'service_role 키 대입' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS Access Key' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, label: 'GCP API Key' },
  { re: /\bghp_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,}\b|\bgho_[0-9A-Za-z]{36}\b/, label: 'GitHub 토큰' },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, label: 'Slack 토큰' },
  { re: /\bsk_live_[0-9A-Za-z]{16,}\b|\brk_live_[0-9A-Za-z]{16,}\b/, label: '결제 라이브 키 (Stripe)' },
  { re: /\b(?:password|passwd|secret|api_secret)\s*[:=]\s*['"][^'"\s]{12,}['"]/i, label: '비밀값 하드코딩 대입' },
];

// 공개 설계상 노출이 의도된 값·파일 — 경로 면제만 허용
const ALLOWLIST_FILES = new Set([
  'src/supabase-config.js',   // Publishable key — 클라이언트 공개 키 (RLS가 실제 보안)
  'ref-pipeline/.env.local.json.example',
]);

const EXTS = new Set(['.js', '.mjs', '.ts', '.json', '.md', '.html', '.css', '.py', '.yml', '.yaml', '.txt', '.env', '.example', '']);
const MAX_SIZE = 512 * 1024;

let files;
try {
  files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
} catch (e) {
  console.log('✗ git ls-files 실패 — git 저장소에서 실행하세요');
  process.exit(2);
}

const hits = [];
for (const rel of files) {
  if (ALLOWLIST_FILES.has(rel)) continue;
  if (!EXTS.has(path.extname(rel).toLowerCase())) continue;
  const abs = path.join(ROOT, rel);
  let stat;
  try { stat = fs.statSync(abs); } catch { continue; }
  if (stat.size > MAX_SIZE) continue;
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const p of PATTERNS) {
      if (p.re.test(lines[i])) {
        hits.push(`${rel}:${i + 1} — ${p.label}`);
        break;
      }
    }
  }
}

if (!hits.length) {
  console.log(`✅ 시크릿 스캔 통과 — 추적 파일 ${files.length}개, 위반 0건`);
  process.exit(0);
}

console.log(`⚠ 시크릿 의심 ${hits.length}건 발견:\n`);
for (const h of hits.slice(0, 30)) console.log(`  ✗ ${h}`);
if (hits.length > 30) console.log(`  …외 ${hits.length - 30}건`);
console.log('\n공개 의도 값이면 check_secrets.js의 ALLOWLIST_FILES에 파일 경로로 면제 등록하세요.');
process.exit(1);
