// src/exam-data-boot.js — 활성 시험 데이터 번들 주입 부트 (클래식 스크립트)
// @spec none (인프라 — ES 모듈 아님)
//
// index.html의 파서 위치에서 실행되어, 활성 시험 dataRoot의 registry.js와
// id_migration.js를 문서에 동기 삽입한다. 과거에는 빌드가 __EXAM_DATA_ROOT__를
// 기본 시험으로 고정 치환해 비기본 시험 부팅에도 기본 시험 번들이 로드됐다 —
// 활성 시험 해석(선택→default→첫 항목)은 exam-context.getActiveExam()과 동일
// 순서를 따른다. localStorage 직접 접근은 ESM 로딩 전 부트 제약상 허용 목록.
//
// document.write는 파싱 중(readyState === 'loading')에만 사용 가능하며,
// 삽입된 스크립트는 파서 생성 스크립트와 동일한 순서 규칙을 따른다
// (클래식 = 삽입 순서 즉시, module = 문서 순서 deferred).
(function () {
    'use strict';
    if (typeof document === 'undefined' || document.readyState !== 'loading') return;
    const list = (typeof window !== 'undefined' && window.EXAMS_LIST) || null;
    const exams = (list && list.exams) || [];
    if (!exams.length) return;
    let selected = null;
    try { selected = localStorage.getItem('current_exam'); } catch (e) { /* file://·사생활 모드 등 접근 불가 시 기본 시험 */ }
    let exam = null;
    let fallback = null;
    for (const e of exams) {
        if (!e) continue;
        if (e.id === selected) { exam = e; break; }
        if (!fallback && e.default) fallback = e;
        if (!fallback) fallback = e;
    }
    exam = exam || fallback;
    if (!exam) return;
    const root = String(exam.dataRoot || '').replace(/^\.\//, '').replace(/\/+$/, '');
    if (!root) return;
    document.write('<script src="' + root + '/id_migration.js"><\/script>');
    document.write('<script type="module" src="' + root + '/registry.js"><\/script>');
})();
