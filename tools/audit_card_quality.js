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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadStudyData() {
    // data/subjects/*.js 파일에서 카드 데이터 로드
    const dataDir = path.join(ROOT, 'data', 'subjects');
    if (!fs.existsSync(dataDir)) {
        console.error('data/subjects/ 디렉토리가 없습니다. 먼저 빌드하세요: npm run build');
        process.exit(1);
    }
    const subjects = {};
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.js'));
    files.forEach(f => {
        const content = fs.readFileSync(path.join(dataDir, f), 'utf-8');
        // 번들 파일에서 window.STUDY_DATA 할당 부분 추출
        const match = content.match(/window\.STUDY_DATA\s*\[["']([^"']+)["']\]\s*=\s*(\{[\s\S]*\});?\s*$/);
        if (match) {
            try {
                const key = match[1];
                const data = eval('(' + match[2] + ')');
                subjects[key] = data;
            } catch (e) {
                console.warn(`파싱 실패: ${f} — ${e.message}`);
            }
        }
    });
    return subjects;
}

function auditCards(subjects) {
    const issues = [];
    const allCards = [];
    const seenTerms = new Map(); // term|definition → [cardId, ...]

    Object.keys(subjects).forEach(subjId => {
        const subj = subjects[subjId];
        if (!subj.cards) return;
        subj.cards.forEach(card => {
            allCards.push({ ...card, subjId });
            const term = card.term || '';
            const def = card.definition || '';

            // 1. 너무 짧은 설명
            if (def.length <= 10) {
                issues.push({ type: 'SHORT_DEF', severity: 'WARN', cardId: card.id, subjId, term, definition: def, message: `설명이 너무 짧음 (${def.length}자)` });
            }
            // 2. 중복 카드
            const key = `${term}|${def}`;
            if (seenTerms.has(key)) {
                issues.push({ type: 'DUPLICATE', severity: 'ERROR', cardId: card.id, subjId, term, definition: def, message: `중복 카드: ${seenTerms.get(key).join(', ')}` });
            } else {
                seenTerms.set(key, [card.id]);
            }
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

    return { issues, totalCards: allCards.length };
}

function auditLinks(subjects) {
    const linkIssues = [];
    const refMdDir = path.join(ROOT, 'content', '참조자료', 'ref_md');
    
    Object.keys(subjects).forEach(subjId => {
        const subj = subjects[subjId];
        if (!subj.chapters) return;
        subj.chapters.forEach(chapter => {
            if (!chapter.sections) return;
            chapter.sections.forEach(section => {
                // 섹션 콘텐츠에서 data-ref-html 링크 추출
                const content = section.content || '';
                const linkRegex = /data-ref-html="([^"]+)"/g;
                let match;
                while ((match = linkRegex.exec(content)) !== null) {
                    const refPath = match[1];
                    const fullPath = path.join(refMdDir, refPath);
                    if (!fs.existsSync(fullPath)) {
                        linkIssues.push({
                            type: 'BROKEN_LINK',
                            severity: 'ERROR',
                            subjId,
                            chapterTitle: chapter.chapterTitle,
                            sectionTitle: section.title,
                            refPath,
                            message: `참조자료 파일 없음: ${refPath}`
                        });
                    }
                }
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
    const { issues, totalCards } = auditCards(subjects);
    console.log(`총 카드: ${totalCards}장`);
    console.log(`이슈: ${issues.length}건\n`);
    
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
    const linkIssues = auditLinks(subjects);
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
