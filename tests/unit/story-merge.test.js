// tests/unit/story-merge.test.js — 이야기형 병합 엔진 검증
// @spec none (콘텐츠 빌드 도구 — story_merge.js 단위 검증)
// 표준형 본문 보존, 서사 삽입, suffix/replace, 앵커 해석, 추출↔적용 왕복을 고정한다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = require('../../tools/build/story_merge.js');

const STD = [
    '# 📗 4과목 맞춤형화장품의 이해',
    '',
    '> **학습 안내**',
    '',
    '## 🧭 학습 아이콘',
    '',
    '| 표시 | 의미 |',
    '',
    '## 📚 Chapter 01. 피부 구조',
    '',
    '피부는 세 층이다.',
    '',
    '## 📚 Chapter 02. 색소',
    '',
    '색소는 멜라닌이다.',
].join('\n');

test('suffix — 제목 부제가 앵커 줄 끝에 붙는다', () => {
    const ops = [
        { kind: 'suffix', anchor: '# 📗 4과목 맞춤형화장품의 이해', n: 1, text: ' — 이야기형 학습교재' },
        { kind: 'suffix', anchor: '## 📚 Chapter 01. 피부 구조', n: 1, text: ' — 수진의 첫 날' },
    ];
    const { text, errors } = M.applyPatch(STD, ops);
    assert.equal(errors.length, 0);
    assert.ok(text.startsWith('# 📗 4과목 맞춤형화장품의 이해 — 이야기형 학습교재'));
    assert.ok(text.includes('## 📚 Chapter 01. 피부 구조 — 수진의 첫 날'));
});

test('insert story — 서사 블록이 마커로 감싸여 앵커 앞에 삽입된다', () => {
    const ops = [{
        kind: 'insert', where: 'before', anchor: '피부는 세 층이다.', n: 1,
        story: true, lines: ['📖 ┈┈ 이야기 ┈┈', '수진은 조제대 앞에 섰다.', '┈┈ 본문 ┈┈ 📘'],
    }];
    const { text, errors } = M.applyPatch(STD, ops);
    assert.equal(errors.length, 0);
    assert.match(text, /<!-- story:start -->\n📖 ┈┈ 이야기 ┈┈\n수진은 조제대 앞에 섰다\.\n┈┈ 본문 ┈┈ 📘\n<!-- story:end -->/);
    assert.ok(text.indexOf('<!-- story:end -->') < text.indexOf('피부는 세 층이다.'));
    // 표준형 본문 보존
    for (const l of STD.split('\n')) assert.ok(text.includes(l), `본문 유실: ${l}`);
});

test('insert at=start/end + 표준형 본문 전량 보존', () => {
    const ops = [
        { kind: 'insert', where: 'start', story: false, lines: ['## 프롤로그'] },
        { kind: 'insert', where: 'end', story: false, lines: ['## 에필로그'] },
    ];
    const { text } = M.applyPatch(STD, ops);
    const lines = text.split('\n');
    assert.equal(lines[0], '## 프롤로그');
    assert.equal(lines.at(-1), '## 에필로그');
});

test('replace — 헤딩 줄 교체', () => {
    const ops = [{ kind: 'replace', anchor: '## 🧭 학습 아이콘', n: 1, lines: ['## 🧭 이야기 아이콘'] }];
    const { text } = M.applyPatch(STD, ops);
    assert.ok(text.includes('## 🧭 이야기 아이콘'));
    assert.ok(!text.includes('## 🧭 학습 아이콘\n'));
});

test('앵커 미해석/중복 — n 지정으로 해결, 없으면 에러 보고', () => {
    const dup = ['a', '', 'x', '', 'x'].join('\n');
    const amb = M.applyPatch(dup, [{ kind: 'insert', where: 'before', anchor: 'x', n: 1, lines: ['INS'] }]);
    assert.equal(amb.errors.length, 0);
    assert.ok(amb.text.split('\n').indexOf('INS') < amb.text.indexOf('x'));
    const miss = M.applyPatch(STD, [{ kind: 'insert', where: 'before', anchor: '없는 줄', n: 1, lines: ['x'] }]);
    assert.ok(miss.errors.length > 0);
    assert.equal(miss.text, null);
});

test('parsePatch ↔ formatPatch 왕복 — 지시어와 블록이 보존된다', () => {
    const patch = [
        '# 패치 헤더', '',
        '<!-- @insert before="피부는 세 층이다." story -->',
        '서사 한 줄', '', '<!-- /@ -->', '',
        '<!-- @suffix line="## 📚 Chapter 01. 피부 구조" -->',
        ' — 부제', '<!-- /@ -->',
    ].join('\n');
    const ops = M.parsePatch(patch);
    assert.equal(ops.length, 2);
    assert.equal(ops[0].kind, 'insert');
    assert.equal(ops[0].story, true);
    assert.deepEqual(ops[0].lines, ['서사 한 줄', '']);
    assert.equal(ops[1].kind, 'suffix');
    assert.equal(ops[1].text, ' — 부제');
    const { text } = M.applyPatch(STD, ops);
    assert.ok(text.includes('<!-- story:start -->'));
    assert.ok(text.includes('피부 구조 — 부제'));
});

test('extractPatch — 기존 이야기형에서 서사·부제·추가섹션을 추출하고 재적용 시 서사 동일', () => {
    const story = [
        '# 📗 4과목 맞춤형화장품의 이해 — 이야기형 학습교재',
        '',
        '> **학습 안내**',
        '',
        '## 🧭 이야기의 등장인물',
        '',
        '• 수진 — 주인공',
        '',
        '## 🧭 학습 아이콘',
        '',
        '| 표시 | 의미 |',
        '',
        '## 📚 Chapter 01. 피부 구조 — 수진의 첫 날',
        '',
        '<!-- story:start -->',
        '',
        '수진이 문을 열었다.',
        '',
        '<!-- story:end -->',
        '',
        '피부는 세 층이다.',
        '',
        '## 📚 Chapter 02. 색소',
        '',
        '색소는 멜라닌이다.',
    ].join('\n');
    const { ops, drift } = M.extractPatch(story, STD);
    assert.ok(Array.isArray(drift));
    const inserts = ops.filter(o => o.kind === 'insert');
    assert.ok(inserts.some(o => o.story), '서사 블록 추출 실패');
    assert.ok(ops.some(o => o.kind === 'suffix' && o.text.includes('이야기형 학습교재')));
    assert.ok(ops.some(o => o.kind === 'suffix' && o.text.includes('수진의 첫 날')));
    assert.ok(inserts.some(o => !o.story && o.lines.join('\n').includes('등장인물')), '추가 섹션 추출 실패');
    // 재적용: 서사 블록 내용 동일
    const patch = M.formatPatch(ops, STD.split('\n'), ['# p']);
    const { text } = M.applyPatch(STD, M.parsePatch(patch));
    const blocksOf = t => [...t.matchAll(/<!-- story:start -->([\s\S]*?)<!-- story:end -->/g)].map(m => m[1]);
    assert.deepEqual(blocksOf(text), blocksOf(story));
});

test('slot — 마커 뒤에 서사가 삽입되고 표준형 문구 편집에 견고하다', () => {
    const withSlot = STD.replace('피부는 세 층이다.', '<!-- story:slot:ch01-s1 -->\n\n피부는 세 층이다.');
    const patch = '<!-- @insert slot="ch01-s1" story -->\n\n서사 한 줄\n\n<!-- /@ -->';
    const { text, errors } = M.applyPatch(withSlot, M.parsePatch(patch));
    assert.equal(errors.length, 0);
    const i = text.indexOf('<!-- story:slot:ch01-s1 -->');
    const j = text.indexOf('<!-- story:start -->');
    const k = text.indexOf('피부는 세 층이다.');
    assert.ok(i >= 0 && i < j && j < k, '마커 뒤·본문 앞에 서사가 와야 함');
    // 주변 문구가 바뀌어도 마커가 살아 있으면 적용됨
    const edited = withSlot.replace('피부는 세 층이다.', '피부는 표피·진피·피하조직 세 층이다.');
    const r2 = M.applyPatch(edited, M.parsePatch(patch));
    assert.equal(r2.errors.length, 0);
});

test('slot — 중복/미등록 마커는 에러로 보고된다', () => {
    const dup = ['a', '<!-- story:slot:x -->', '', '<!-- story:slot:x -->'].join('\n');
    const p = '<!-- @insert slot="x" -->\nINS\n<!-- /@ -->';
    assert.ok(M.applyPatch(dup, M.parsePatch(p)).errors.length > 0);
    const missing = M.applyPatch(STD, M.parsePatch('<!-- @insert slot="없음" -->\nINS\n<!-- /@ -->'));
    assert.ok(missing.errors.length > 0);
    assert.equal(missing.text, null);
});

test('실제 cosmetic 4과목 — 패치↔생성물 왕복 정합성', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'content/exams/cosmetic/manifest.json'), 'utf8'));
    for (const subj of manifest.subjects) {
        for (const ch of subj.chapters || []) {
            if (!ch.storyFile) continue;
            const dir = join(ROOT, 'content/exams/cosmetic', subj.dir);
            const base = ch.file.replace(/_표준형\.md$/i, '');
            const patchPath = join(dir, 'story', `${base}_서사.md`);
            const storyPath = join(dir, ch.storyFile);
            let patch;
            try { patch = readFileSync(patchPath, 'utf8'); } catch {
                throw new Error(`패치 없음: ${patchPath}`);
            }
            const std = readFileSync(join(dir, ch.file), 'utf8');
            const { text, errors } = M.applyPatch(std, M.parsePatch(patch));
            assert.deepEqual(errors, [], `${subj.dir}: ${errors.join('; ')}`);
            assert.equal(M.norm(readFileSync(storyPath, 'utf8')), M.norm(M.GEN_BANNER + '\n' + text),
                `${subj.dir}: 생성물 불일치 — npm run build:story 필요`);
        }
    }
});
