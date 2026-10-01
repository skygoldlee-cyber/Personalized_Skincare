// tests/unit/audio-manifest.test.js — 오디오 매니페스트 커버리지 검증
// @spec AO-06
// manifest 챕터 수 ↔ 스캔 MP3 수 대조: 불일치 경고·미등록 과목 경고·미스캔 스킵을 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { checkAudioCoverage } = require(join(ROOT, 'tools/build/build_audio_manifest.js'));

const TARGET = {
    id: 'cosmetic',
    manifest: {
        subjects: [
            { key: 'law', chapters: [{ file: 'a.md' }] },
            { key: 'safety', chapters: [{ file: 'b.md' }, { file: 'c.md' }] },
        ],
    },
};

test('AO-06: 챕터 수와 MP3 수가 일치하면 경고 없음', () => {
    const scanned = {
        law: { 0: 'content/exams/cosmetic/audiobook/mp3/law/ch01.mp3' },
        safety: { 0: 'x', 1: 'y' },
    };
    assert.deepEqual(checkAudioCoverage(TARGET, scanned), []);
});

test('AO-06: 수치 불일치는 경고, MP3 미스캔(0개)은 경고 아님', () => {
    const scanned = {
        law: { 0: 'x', 1: 'y' }, // manifest 1챕터 vs MP3 2개 → 경고
        // safety는 MP3 없음 → 미커밋으로 간주, 경고 없음
    };
    const warnings = checkAudioCoverage(TARGET, scanned);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('law') && warnings[0].includes('1개 vs MP3 2개'));
});

test('AO-06: manifest에 없는 과목 디렉터리는 경고', () => {
    const scanned = { ghost: { 0: 'x' } };
    const warnings = checkAudioCoverage(TARGET, scanned);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('ghost') && warnings[0].includes('manifest에 없는 과목'));
});

test('AO-06: manifest가 없으면 빈 경고', () => {
    assert.deepEqual(checkAudioCoverage({ id: 'x', manifest: null }, {}), []);
});
