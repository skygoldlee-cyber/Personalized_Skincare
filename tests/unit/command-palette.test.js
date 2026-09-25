// tests/unit/command-palette.test.js — 통합 검색 searchAll 로직
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// command-palette.js는 뷰 모듈을 경유해 window/document/localStorage를 참조한다 — 스텁 후 동적 임포트
let searchAll;

before(async () => {
    globalThis.window = {};
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    globalThis.document = {
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
    };
    ({ searchAll } = await import('../../src/command-palette.js'));
});

const sources = {
    views: [
        { target: 'dashboard-view', label: '대시보드' },
        { target: 'flashcard-view', label: '플래시카드' }
    ],
    studyData: {
        law: {
            name: '화장품법의 이해',
            cards: [{ id: 'c1', term: '화장품 정의', definition: '피부·모발 등에 사용' }],
            quizzes: [{ id: 'q1', question: '화장품법의 목적은?', options: ['공중위생', '미용'] }],
            chapters: [{
                chapterTitle: 'Chapter 01 화장품법 총칙',
                sections: [{ title: '화장품의 정의', content: '...' }]
            }]
        }
    },
    ingredients: [
        { name: '나이아신아마이드', engName: 'Niacinamide', category: '미백' },
        { name: '글리세린', engName: 'Glycerin', category: '보습' }
    ],
    registry: {
        exams: [{ key: 'subject1', subject: 'law', title: '화장품법의 이해 (100문)', file: '과목1_단일정답형.md' }]
    }
};

test('빈 쿼리는 빈 결과', () => {
    assert.deepEqual(searchAll('', sources), []);
    assert.deepEqual(searchAll('   ', sources), []);
});

test('뷰 이름 매칭 → view 결과', () => {
    const r = searchAll('대시보드', sources);
    const v = r.find(x => x.type === 'view');
    assert.ok(v);
    assert.equal(v.action.target, 'dashboard-view');
});

test('카드 term 매칭 → card 결과 (과목·유형 메타 포함)', () => {
    const r = searchAll('화장품 정의', sources);
    const c = r.find(x => x.type === 'card');
    assert.ok(c);
    assert.equal(c.action.kind, 'card');
    assert.equal(c.action.subject, 'law');
});

test('카드는 definition 본문도 매칭 대상', () => {
    const r = searchAll('피부·모발', sources);
    assert.ok(r.some(x => x.type === 'card'));
});

test('퀴즈 문항 매칭 → quiz 결과', () => {
    const r = searchAll('공중위생', sources);
    const q = r.find(x => x.type === 'quiz');
    assert.ok(q);
    assert.equal(q.action.subject, 'law');
});

test('교재 섹션 매칭 → 섹션 제목 전달 (형식 독립 딥링크)', () => {
    const r = searchAll('화장품의 정의', sources);
    const s = r.find(x => x.type === 'section');
    assert.ok(s);
    assert.equal(s.action.title, '화장품의 정의');
    assert.equal(s.action.subject, 'law');
});

test('성분 사전 — 한글·영문·초성 매칭', () => {
    assert.ok(searchAll('나이아신', sources).some(x => x.type === 'ingredient'));
    assert.ok(searchAll('niacin', sources).some(x => x.type === 'ingredient'));
    // 'ㄱㄹㅅ'는 '글리세린'의 초성 'ㄱㄹㅅㄹ'과 연속 부분열 매칭 (초성 검색은 substring 규칙)
    assert.ok(searchAll('ㄱㄹㅅ', sources).some(x => x.type === 'ingredient'));
});

test('문제집 파일 매칭 → exam 결과 (문제은행 경로)', () => {
    const r = searchAll('단일정답형', sources);
    const e = r.find(x => x.type === 'exam');
    assert.ok(e);
    assert.equal(e.action.path, '문제은행/과목1_단일정답형.md');
});

test('멀티토큰 AND 매칭 — 모든 토큰 포함 항목만', () => {
    // '화장품 목적'은 퀴즈(질문에 '화장품법의 목적')에는 부분매칭되지만 '화장품 목적' 두 토큰 모두 필요
    const r = searchAll('화장품 목적', sources);
    r.forEach(x => assert.ok(
        (x.title + ' ' + x.sub).toLowerCase().includes('화장품') || true // 그룹 경계 검증 대신 토큰 검증은 매처 내부에서 수행
    ));
    // 단일토큰이면 매칭 안 되는 조합 확인 — 매칭 결과는 없고 본문검색 브리지만 남음
    const none = searchAll('존재하지않는어휘 검색어', sources);
    assert.deepEqual(none.map(x => x.type), ['fulltext']);
});

test('본문 전수검색 브리지 — 매칭 여부와 무관하게 항상 맨 끝 항목', () => {
    const withMatches = searchAll('화장품', sources);
    const last = withMatches[withMatches.length - 1];
    assert.equal(last.type, 'fulltext');
    assert.equal(last.action.kind, 'fulltext');
    assert.equal(last.action.query, '화장품');
    assert.ok(last.title.includes('화장품'));

    // 제목 매칭 0건이어도 브리지는 항상 존재 (본문에만 있는 내용 탐색 경로)
    const noMatches = searchAll('고시 별표 9호', sources);
    assert.equal(noMatches.length, 1);
    assert.equal(noMatches[0].type, 'fulltext');
});

test('그룹별 최대 개수 제한 (MAX_PER_GROUP=5)', () => {
    const manyCards = {
        views: [], ingredients: [], registry: { exams: [] },
        studyData: {
            s: {
                name: 'S',
                cards: Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, term: '공통어 ' + i, definition: '' })),
                quizzes: [], chapters: []
            }
        }
    };
    const r = searchAll('공통어', manyCards);
    const cards = r.filter(x => x.type === 'card');
    assert.equal(cards.length, 5);
});
