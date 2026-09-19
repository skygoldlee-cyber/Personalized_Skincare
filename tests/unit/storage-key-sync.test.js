// 스토리지 키 드리프트 가드 — 클래식 스크립트/비모듈 코드에 하드코딩된
// localStorage 키 리터럴이 STORAGE_KEYS 와 어긋나지 않는지 검증한다.
// 대표 사례: src/theme-init.js는 classic <script>라 import 불가 → 'appTheme' 리터럴 사용.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { STORAGE_KEYS } = await import(pathToFileURL(join(ROOT, 'src/storage-keys.js')).href);

test('theme-init.js의 appTheme 리터럴이 STORAGE_KEYS.APP_THEME와 일치', () => {
    const src = readFileSync(join(ROOT, 'src/theme-init.js'), 'utf8');
    const m = src.match(/localStorage\.getItem\('([^']+)'\)/);
    assert.ok(m, 'theme-init.js에서 localStorage 키 리터럴을 찾지 못함');
    assert.equal(m[1], STORAGE_KEYS.APP_THEME,
        `theme-init.js 키('${m[1]}')가 STORAGE_KEYS.APP_THEME('${STORAGE_KEYS.APP_THEME}')와 다릅니다 — 동기화 필요`);
});

test('exam-context.js GLOBAL_KEYS가 STORAGE_KEYS/실제 사용 키와 일치', () => {
    const src = readFileSync(join(ROOT, 'src/exam-context.js'), 'utf8');
    // GLOBAL_KEYS에 포함되어야 할 전역 키들 (테마·방향·리더 설정 등 시험 무관 키)
    for (const key of [STORAGE_KEYS.APP_THEME, STORAGE_KEYS.PREFERRED_ORIENTATION]) {
        assert.ok(src.includes(`'${key}'`),
            `exam-context.js GLOBAL_KEYS에 '${key}'가 없습니다 — 네임스페이스 오적용 위험`);
    }
});
