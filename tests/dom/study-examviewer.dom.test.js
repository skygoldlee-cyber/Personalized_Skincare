// tests/dom/study-examviewer.dom.test.js — 문제집 뷰어 시나리오
// 설계: docs/dev/DOM_TEST_DESIGN.md §5.2 (Phase 5)
// 검증: 문제집 열기→오버레이·MD 렌더·TOC(H) · 인쇄 버튼→window.print(H)
//       · 캐시(P) · 닫기(H) · 미존재 문서 오류(X)
// __EXAM_MD__ 번들 스텁으로 주입
// 참고: _overlayEl 모듈 상태 잔존 방지를 위해 매 테스트 모듈 리셋

import { describe, it, beforeEach, expect, vi } from 'vitest';

import { loadIndexHtml, el, flushAsync } from './helpers.js';

const EXAM_MD = '# 1과목 문제은행\n\n## 파트 A\n\n1. 문제 본문입니다.\n\n## 파트 B\n\n2. 다음 문제.\n';
const EXAM_PATH = 'content/exams/cosmetic/문제은행/subject1_bank.md';

describe('문제집 뷰어 — 열기·TOC·인쇄·캐시', () => {
    let ExamViewer;
    beforeEach(async () => {
        localStorage.clear();
        sessionStorage.clear();
        vi.resetModules();
        ({ ExamViewer } = await import('../../src/exam-viewer.js'));
        loadIndexHtml();
        window.__EXAM_MD__ = { [EXAM_PATH]: EXAM_MD };
        Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
        window.print = vi.fn();
        vi.clearAllMocks();
    });

    it('openExam → 오버레이 open + 본문·TOC 렌더 (H)', async () => {
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);

        expect(ExamViewer.isOpen()).toBe(true);
        expect(el('exam-ov-title').textContent).toContain('subject1 bank');
        const article = el('exam-article');
        expect(article.textContent).toContain('문제 본문입니다');
        const toc = document.querySelector('.exam-ov-toc');
        expect(toc).not.toBeNull();
        expect(toc.querySelectorAll('[data-exam-jump]').length).toBe(2);
    });

    it('인쇄 버튼 → window.print 호출 (H)', async () => {
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);

        document.querySelector('[data-exam-print]').click();
        expect(window.print).toHaveBeenCalled();
    });

    it('재오픈 → sessionStorage 캐시 재사용 (P)', async () => {
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);
        ExamViewer.close();

        delete window.__EXAM_MD__;
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);
        expect(el('exam-article').textContent).toContain('문제 본문입니다');
    });

    it('미존재 문서 → 오류 화면 (X)', async () => {
        // jsdom은 외부 스크립트 로드 이벤트를 발생시키지 않으므로,
        // 번들 스크립트를 로드 실패 상태로 사전 삽입해 reject 경로로 유도
        const s = document.createElement('script');
        s.dataset.examBundle = 'data/exams/cosmetic/exams_md/nonexistent.js';
        s.dataset.loaded = 'error';
        document.head.appendChild(s);

        await ExamViewer.openExam('content/nonexistent.md');
        await flushAsync(30);

        expect(el('exam-article').textContent).toContain('문제집을 불러올 수 없습니다');
    });

    it('ref_md 문서 → joinWraps로 문장 중간 절단 병합 + 라인 span 유지 (H)', async () => {
        const REF_PATH = 'content/exams/cosmetic/참조자료/ref_md/과목1/화장품법/화장품법.md';
        window.__EXAM_MD__[REF_PATH] =
            '# 화장품법(법률)\n\n제1조(목적) 이 법은 화장품의 품질을 적정하게 관리하여 국민보건 향상에 이바지함을 목\n' +
            '적으로 한다.\n제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.';

        await ExamViewer.openExam(REF_PATH);
        await flushAsync(30);

        const article = el('exam-article');
        // "목\n적으로"가 하나의 문단으로 병합 (무공백 결합)
        expect(article.querySelectorAll('p').length).toBe(2);
        expect(article.textContent).toContain('목적으로 한다');
        // 연속줄에 data-md-line span이 유지되어 인용 스크롤 대상 존재
        const span = article.querySelector('span[data-md-line]');
        expect(span).not.toBeNull();
        expect(span.textContent).toContain('적으로');
    });

    it('비 ref_md 문서 → joinWraps 미적용 (줄 단위 문단 유지) (H)', async () => {
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);
        // 문제은행 경로는 ref_md가 아니므로 병합 없이 렌더
        expect(el('exam-article').querySelector('span[data-md-line]')).toBeNull();
    });

    it('닫기 → 오버레이 닫힘·body 클래스 해제', async () => {
        await ExamViewer.openExam(EXAM_PATH);
        await flushAsync(30);
        ExamViewer.close();

        expect(ExamViewer.isOpen()).toBe(false);
        expect(document.body.classList.contains('exam-open')).toBe(false);
    });
});
