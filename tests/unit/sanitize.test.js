import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, safeTextWithBreaks, esc } from '../../src/sanitize.js';

test('escapeHTML: 특수문자 이스케이프', () => {
    assert.equal(escapeHTML('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.equal(escapeHTML('"hello"'), '&quot;hello&quot;');
    assert.equal(escapeHTML("it's"), 'it&#39;s');
    assert.equal(escapeHTML('a & b'), 'a &amp; b');
});

test('escapeHTML: 일반 문자열은 그대로 반환', () => {
    assert.equal(escapeHTML('Hello World'), 'Hello World');
    assert.equal(escapeHTML('한글 텍스트'), '한글 텍스트');
});

test('escapeHTML: null/undefined는 빈 문자열 반환', () => {
    assert.equal(escapeHTML(null), '');
    assert.equal(escapeHTML(undefined), '');
});

test('escapeHTML: 비문자열은 문자열로 변환 후 이스케이프', () => {
    assert.equal(escapeHTML(123), '123');
    assert.equal(escapeHTML(true), 'true');
});

test('escapeHTML: 모든 특수문자가 혼재된 경우', () => {
    const input = '<div class="x" data-y=\'z\'>&</div>';
    const expected = '&lt;div class=&quot;x&quot; data-y=&#39;z&#39;&gt;&amp;&lt;/div&gt;';
    assert.equal(escapeHTML(input), expected);
});

test('safeTextWithBreaks: 개행을 <br>로 변환', () => {
    assert.equal(safeTextWithBreaks('line1\nline2'), 'line1<br>line2');
    assert.equal(safeTextWithBreaks('a\r\nb'), 'a<br>b');
    assert.equal(safeTextWithBreaks('a\rb'), 'a<br>b');
});

test('safeTextWithBreaks: 특수문자 이스케이프 후 개행 변환', () => {
    assert.equal(safeTextWithBreaks('<b>\n</b>'), '&lt;b&gt;<br>&lt;/b&gt;');
});

test('safeTextWithBreaks: 개행이 없으면 escapeHTML과 동일', () => {
    assert.equal(safeTextWithBreaks('hello & world'), 'hello &amp; world');
});

test('esc: escapeHTML의 별칭으로 동일 동작', () => {
    assert.equal(esc('<x>'), escapeHTML('<x>'));
    assert.equal(esc(null), '');
    assert.equal(esc('normal'), 'normal');
});
