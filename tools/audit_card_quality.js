// tools/audit_card_quality.js — 콘텐츠 품질 자동 감사 도구
//
// 실행: node tools/audit_card_quality.js
//
// 점검 항목:
// 1. 너무 짧은 설명 (definition length <= 10)
// 2. 중복 카드 (동일 term + definition)
// 3. 의미 없는 카드 (term === definition)
// 4. 너무 긴 term (length > 50)
// 5. 너무 짧은 term (length <= 2)
// 6. 빈 definition
// 7. importance < 40 (저품질)
// 8. 참조자료 링크 유효성 (파일 존재 여부)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const plugin = require('./build/plugins/textbook.plugin.js');
const idFactory = require('./build/id-factory.js');
const { getExamTargets } = require('./build/exam-targets.js');

function loadStudyData() {
    // data/subjects/*.js 번들은 폐지됨 — 앱과 동일하게 content/*.md를
    // 빌드 파서(textbook.plugin)로 직접 파싱해 카드/챕터를 얻는다.
    const subjects = {};
    for (const target of getExamTargets(ROOT)) {
        if (!target.manifest) continue;
        for (const subject of target.manifest.subjects || []) {
            subjects[`${target.id}:${subject.key}`] = plugin.build(subject, {
                workspaceDir: ROOT, idFactory,
                contentRoot: target.contentRoot, dataRoot: target.dataRoot
            });
        }
    }
    return subjects;
}

function auditCards(subjects) {
    const issues = [];
    const allCards = [];
    const seenTerms = new Map();   // subjId → Map(term|definition → [cardId, ...]) — 과목 내 중복만 오류
    const crossSubject = new Map(); // term|definition → Set(subjId) — 과목 간 중복은 정보 보고

    Object.keys(subjects).forEach(subjId => {
        const subj = subjects[subjId];
        if (!subj.cards) return;
        if (!seenTerms.has(subjId)) seenTerms.set(subjId, new Map());
        const subjSeen = seenTerms.get(subjId);
        subj.cards.forEach(card => {
            allCards.push({ ...card, subjId });
            const term = card.term || '';
            const def = card.definition || '';

            // 1. 너무 짧은 설명
            if (def.length <= 10) {
                issues.push({ type: 'SHORT_DEF', severity: 'WARN', cardId: card.id, subjId, term, definition: def, message: `설명이 너무 짧음 (${def.length}자)` });
            }
            // 2. 중복 카드 — 같은 과목 내 term+definition 중복만 오류.
            //    과목 간 동일 카드는 시험 범위 중첩으로 정상이므로 별도 집계.
            const key = `${term}|${def}`;
            if (subjSeen.has(key)) {
                issues.push({ type: 'DUPLICATE', severity: 'ERROR', cardId: card.id, subjId, term, definition: def, message: `과목 내 중복 카드: ${subjSeen.get(key).join(', ')}` });
            } else {
                subjSeen.set(key, [card.id]);
            }
            if (!crossSubject.has(key)) crossSubject.set(key, new Set());
            crossSubject.get(key).add(subjId);
            // 3. 의미 없는 카드
            if (term === def && term.length > 0) {
                issues.push({ type: 'SELF_REF', severity: 'ERROR', cardId: card.id, subjId, term, definition: def, message: 'term과 definition이 동일' });
            }
            // 4. 너무 긴 term
            if (term.length > 50) {
                issues.push({ type: 'LONG_TERM', severity: 'WARN', cardId: card.id, subjId, term, definition: def, message: `term이 너무 김 (${term.length}자)` });
            }
            // 5. 너무 짧은 term
            if (term.length <= 2) {
                issues.push({ type: 'SHORT_TERM', severity: 'WARN', cardId: card.id, subjId, term, definition: def, message: `term이 너무 짧음 (${term.length}자)` });
            }
            // 6. 빈 definition
            if (!def || def.trim().length === 0) {
                issues.push({ type: 'EMPTY_DEF', severity: 'ERROR', cardId: card.id, subjId, term, definition: def, message: 'definition이 비어 있음' });
            }
            // 7. 저품질
            if (card.importance < 40) {
                issues.push({ type: 'LOW_QUALITY', severity: 'WARN', cardId: card.id, subjId, term, definition: def, message: `importance < 40 (${card.importance})` });
            }
        });
    });

    const crossDupes = [...crossSubject.values()].filter(s => s.size > 1).length;
    return { issues, totalCards: allCards.length, crossDupes };
}

function auditLinks(subjects, examRoots) {
    const linkIssues = [];
    // 시험별 contentRoot 해석 (subjects 키는 `${examId}:${subjectKey}`)
    const rootOf = (subjId) => {
        const examId = subjId.split(':')[0];
        return path.join(ROOT, (examRoots[examId] || 'content/exams/' + examId));
    };
    // 원시 마크다운의 참조자료 링크: ../참조자료/... (URL 인코딩 포함)
    const linkRegex = /참조자료\/[^\s)`'"<>*]+/g;
    const seen = new Set();

    const checkContent = (subjId, chapterTitle, sectionTitle, content) => {
        if (!content) return;
        linkRegex.lastIndex = 0;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            const refPath = decodeURIComponent(match[0]);
            const dedupeKey = `${subjId}|${refPath}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            if (!fs.existsSync(path.join(rootOf(subjId), refPath))) {
                linkIssues.push({
                    type: 'BROKEN_LINK',
                    severity: 'ERROR',
                    subjId,
                    chapterTitle,
                    sectionTitle,
                    refPath,
                    message: `참조자료 파일 없음: ${refPath}`
                });
            }
        }
    };

    Object.keys(subjects).forEach(subjId => {
        const subj = subjects[subjId];
        if (!subj.chapters) return;
        subj.chapters.forEach(chapter => {
            (chapter.sections || []).forEach(section => {
                checkContent(subjId, chapter.chapterTitle, section.title, section.content);
                (section.subsections || []).forEach(sub =>
                    checkContent(subjId, chapter.chapterTitle, `${section.title} > ${sub.title}`, sub.content));
            });
        });
    });
    return linkIssues;
}

function main() {
    console.log('=== 콘텐츠 품질 점검 도구 ===\n');
    
    const subjects = loadStudyData();
    const subjectCount = Object.keys(subjects).length;
    console.log(`로드된 과목: ${subjectCount}개\n`);
    
    if (subjectCount === 0) {
        console.error('과목 데이터가 없습니다. 빌드를 먼저 실행하세요.');
        process.exit(1);
    }
    
    // 카드 품질 감사
    console.log('--- 카드 품질 감사 ---');
    const { issues, totalCards, crossDupes } = auditCards(subjects);
    console.log(`총 카드: ${totalCards}장`);
    console.log(`이슈: ${issues.length}건`);
    console.log(`과목 간 중복(정보): ${crossDupes}건 — 시험 범위 중첩으로 정상\n`);
    
    const byType = {};
    issues.forEach(i => {
        byType[i.type] = (byType[i.type] || 0) + 1;
    });
    Object.keys(byType).forEach(type => {
        console.log(`  ${type}: ${byType[type]}건`);
    });
    
    // 심각도별 요약
    const errors = issues.filter(i => i.severity === 'ERROR');
    const warns = issues.filter(i => i.severity === 'WARN');
    console.log(`\n  오류: ${errors.length}건, 경고: ${warns.length}건`);
    
    // 상세 출력 (최대 20건)
    if (issues.length > 0) {
        console.log('\n--- 상세 (최대 20건) ---');
        issues.slice(0, 20).forEach(i => {
            console.log(`  [${i.severity}] ${i.type}: ${i.cardId || 'N/A'} — ${i.message}`);
            if (i.term) console.log(`    term: ${i.term.substring(0, 60)}`);
        });
        if (issues.length > 20) console.log(`  ... 외 ${issues.length - 20}건`);
    }
    
    // 링크 유효성 감사
    console.log('\n--- 참조자료 링크 감사 ---');
    const examRoots = {};
    for (const t of getExamTargets(ROOT)) examRoots[t.id] = t.contentRoot;
    const linkIssues = auditLinks(subjects, examRoots);
    console.log(`이슈: ${linkIssues.length}건`);
    if (linkIssues.length > 0) {
        console.log('\n--- 상세 ---');
        linkIssues.slice(0, 20).forEach(i => {
            console.log(`  [${i.severity}] ${i.type}: ${i.subjId}/${i.chapterTitle} — ${i.message}`);
        });
        if (linkIssues.length > 20) console.log(`  ... 외 ${linkIssues.length - 20}건`);
    }
    
    // 요약
    console.log('\n=== 요약 ===');
    console.log(`총 카드: ${totalCards}장`);
    console.log(`카드 이슈: ${issues.length}건 (오류 ${errors.length}, 경고 ${warns.length})`);
    console.log(`링크 이슈: ${linkIssues.length}건`);
    
    const hasErrors = errors.length > 0 || linkIssues.length > 0;
    process.exit(hasErrors ? 1 : 0);
}

main();
