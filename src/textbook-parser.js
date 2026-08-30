// src/textbook-parser.js — 교재 MD 런타임 파서 (브라우저 ESM)
// tools/build/plugins/textbook.plugin.js 의 충실한 포팅.
// 목표: 기존 빌드 산출물(data/subjects/*.js)과 카드/퀴즈/챕터/ID가 바이트 단위로 동일.
// 어떤 정규식/분기/트림도 결과를 바꾸지 않도록 원본 로직을 그대로 유지한다.
import { stableId } from './sha256.js';

const cleanText = (text) => {
    if (!text) return '';
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/🔖기출/g, '')
        .replace(/📌중요/g, '')
        .replace(/🎯\s*기출/g, '')
        .replace(/🎯\s*중요/g, '')
        .trim();
};

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function basenameNoMd(filename) {
    // path.basename(filename, '.md') 동등: 경로 구분자 제거 후 .md 확장자 제거
    const base = String(filename).split(/[\\/]/).pop();
    return base.endsWith('.md') ? base.slice(0, -3) : base;
}

// --- 카드/퀴즈 추출 (parseMarkdownFile 포팅) ---
function parseMarkdownFile(content, subjectId, filename, chapterKey) {
    const lines = content.split(/\r?\n/);

    const cards = [];
    const quizzes = [];
    const warnings = [];

    const quizIdCounts = new Map();
    const makeQuizId = (term, answer) => {
        const base = `${term}|${answer}`;
        const n = (quizIdCounts.get(base) || 0) + 1;
        quizIdCounts.set(base, n);
        const input = n === 1 ? base : `${base}#${n}`;
        return stableId(subjectId, chapterKey, 'quiz', input);
    };

    let currentSection = basenameNoMd(filename);
    let skipSection = false;
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    const processTable = (headers, rows) => {
        if (rows.length === 0) return;

        const termIdx = 0;
        const descIdx = headers.length > 1 ? 1 : 0;

        rows.forEach(row => {
            if (row.length < 2) return;

            const rawTerm = row[termIdx] || '';
            const rawDesc = row[descIdx] || '';

            const term = cleanText(rawTerm);
            const desc = cleanText(rawDesc);

            if (!term || !desc) return;

            // 비교표의 체크/대시 마커 등 의미 없는 definition 건너뛰기
            if (/^[—–\-✔✖×○●□■☆★]$/.test(desc)) return;

            // 숫자만 있는 term (표 행 번호, 수치값) 건너뛰기
            if (/^\d+$/.test(term)) return;

            // ①②③ 등 원번호 기호 및 (L숫자) 줄번호 참조 제거
            const cleanTerm = term.replace(/\*\*/g, '').replace(/\s*\(L\d+\)\s*/g, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').trim();
            if (!cleanTerm) return;

            // 1~2자 키워드는 의미 부족으로 건너뛰기
            if (cleanTerm.length <= 2) return;

            const has기출 = rawTerm.includes('🔖기출') || rawDesc.includes('🔖기출');
            const isKey = has기출 || rawTerm.includes('📌중요') || rawDesc.includes('📌중요');
            // definition에서도 (L숫자) 줄번호 참조 제거
            const cleanDesc = desc.replace(/\s*\(L\d+\)\s*/g, ' ').trim();

            // term과 definition이 동일하면 의미 없는 카드이므로 건너뛰기
            if (cleanTerm === cleanDesc) return;

            cards.push({
                id: stableId(subjectId, chapterKey, 'card', cleanTerm),
                category: currentSection,
                term: cleanTerm,
                definition: cleanDesc,
                isKey: isKey
            });

            if (isKey) {
                let quizzesForRow = 0;
                const boldMatches = [];
                let match;
                const boldRegex = /\*\*([^*]+)\*\*/g;
                while ((match = boldRegex.exec(rawDesc)) !== null) {
                    boldMatches.push(match);
                }

                const numMatches = [];
                const numRegex = /\b\d+(?:\.\d+)?(?:%|세 이하|세 이상|개월|일|년|배|종|가지|개|시간|g|ml|kg|℃|도|분|초|주|ppm|㎛|회\/hr|개\/hr|개\/㎥)\b/g;
                while ((match = numRegex.exec(rawDesc)) !== null) {
                    numMatches.push(match);
                }

                if (boldMatches.length > 0) {
                    boldMatches.forEach(match => {
                        const answer = match[1].trim();
                        if (answer.length > 1) {
                            const quizText = cleanDesc.replace(new RegExp(`\\*\\*${escapeRegExp(answer)}\\*\\*|${escapeRegExp(answer)}`, 'g'), ' [ 빈칸 ] ');
                            quizzes.push({
                                id: makeQuizId(cleanTerm, answer),
                                category: currentSection,
                                context: `[용어: ${cleanTerm}]`,
                                question: quizText,
                                answer: answer,
                                type: 'blank'
                            });
                            quizzesForRow++;
                        }
                    });
                } else if (numMatches.length > 0) {
                    numMatches.forEach(match => {
                        const answer = match[0].trim();
                        const quizText = cleanDesc.replace(new RegExp(escapeRegExp(answer), 'g'), ' [ 빈칸 ] ');
                        quizzes.push({
                            id: makeQuizId(cleanTerm, answer),
                            category: currentSection,
                            context: `[용어: ${cleanTerm}]`,
                            question: quizText,
                            answer: answer,
                            type: 'blank'
                        });
                        quizzesForRow++;
                    });
                } else {
                    quizzes.push({
                        id: makeQuizId(cleanTerm, cleanTerm),
                        category: currentSection,
                        context: `정의에 알맞은 용어를 적으시오.`,
                        question: `${cleanDesc}`,
                        answer: cleanTerm,
                        type: 'term'
                    });
                    quizzesForRow++;
                }

                if (has기출 && quizzesForRow === 0) {
                    warnings.push(cleanTerm || desc.substring(0, 40));
                }
            }
        });
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('## ')) {
            currentSection = line.substring(3).trim();
            skipSection = currentSection.startsWith('🧭') || currentSection.startsWith('🎯 과목 시각화');
            continue;
        }

        if (skipSection) continue;

        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHeaders = line.split('|').map(h => h.trim()).filter(h => h !== '');
                tableRows = [];
                if (i + 1 < lines.length && lines[i + 1].trim().includes('---')) {
                    i++;
                }
            } else {
                const rowCells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                if (rowCells.length > 0) {
                    tableRows.push(rowCells);
                }
            }
        } else {
            if (inTable) {
                processTable(tableHeaders, tableRows);
                inTable = false;
            }

            if (line.includes('🔖기출') || line.includes('📌중요')) {
                const has기출Line = line.includes('🔖기출');
                let quizzesForLine = 0;
                const cleanedLine = cleanText(line);
                const listMatch = line.match(/^[-*]\s+\*\*([^*]+)\*\*(?:\s*🔖기출)?\s*[:：-]\s*(.+)$/);
                if (listMatch) {
                    const term = cleanText(listMatch[1]).replace(/\s*\(L\d+\)\s*/g, '').trim();
                    const desc = listMatch[2].trim();
                    const cleanDesc = cleanText(desc).replace(/\s*\(L\d+\)\s*/g, ' ').trim();
                    cards.push({
                        id: stableId(subjectId, chapterKey, 'card', term),
                        category: currentSection,
                        term: term,
                        definition: cleanDesc,
                        isKey: true
                    });

                    const boldMatches = [];
                    let match;
                    const boldRegex = /\*\*([^*]+)\*\*/g;
                    while ((match = boldRegex.exec(desc)) !== null) {
                        boldMatches.push(match);
                    }

                    if (boldMatches.length > 0) {
                        boldMatches.forEach(m => {
                            const ans = m[1].trim();
                            quizzes.push({
                                id: makeQuizId(term, ans),
                                category: currentSection,
                                context: `[주제: ${term}]`,
                                question: cleanDesc.replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] '),
                                answer: ans,
                                type: 'blank'
                            });
                            quizzesForLine++;
                        });
                    }
                } else {
                    const numMatches = [];
                    let match;
                    const numRegex = /\b\d+(?:\.\d+)?(?:%|세 이하|세 이상|개월|일|년|배|종|가지|개|시간|g|ml|kg|℃|도|분|초|주|ppm|㎛|회\/hr|개\/hr|개\/㎥)\b/g;
                    while ((match = numRegex.exec(cleanedLine)) !== null) {
                        numMatches.push(match);
                    }

                    const boldMatches = [];
                    const boldRegex = /\*\*([^*]+)\*\*/g;
                    while ((match = boldRegex.exec(line)) !== null) {
                        boldMatches.push(match);
                    }

                    if (boldMatches.length > 0) {
                        boldMatches.forEach(m => {
                            const ans = m[1].trim();
                            if (ans.length > 1 && !ans.includes('기출') && !ans.includes('중요')) {
                                quizzes.push({
                                    id: makeQuizId(cleanedLine.substring(0, 15), ans),
                                    category: currentSection,
                                    context: `[기출 지문 빈칸 채우기]`,
                                    question: cleanedLine.replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] '),
                                    answer: ans,
                                    type: 'blank'
                                });
                                quizzesForLine++;
                            }
                        });
                    } else if (numMatches.length > 0) {
                        numMatches.forEach(m => {
                            const ans = m[0].trim();
                            quizzes.push({
                                id: makeQuizId(cleanedLine.substring(0, 15), ans),
                                category: currentSection,
                                context: `[기출 지문 빈칸 채우기]`,
                                question: cleanedLine.replace(new RegExp(escapeRegExp(ans), 'g'), ' [ 빈칸 ] '),
                                answer: ans,
                                type: 'blank'
                            });
                            quizzesForLine++;
                        });
                    }
                }

                if (has기출Line && quizzesForLine === 0) {
                    warnings.push(cleanedLine.substring(0, 40));
                }
            }
        }
    }

    if (inTable) {
        processTable(tableHeaders, tableRows);
    }

    return { cards, quizzes, warnings };
}

// --- 챕터/섹션 추출 (parseTextbookContent 포팅) ---
function parseTextbookContent(content, filename, subjectDir) {
    const lines = content.split(/\r?\n/);

    let chapterTitle = basenameNoMd(filename);
    let chapterTitleSet = false;
    const sections = [];

    let currentSectionTitle = '개요';
    let currentSectionLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('# ')) {
            if (!chapterTitleSet) {
                chapterTitle = trimmed.substring(2).trim();
                chapterTitleSet = true;
            }
            continue;
        }

        if (trimmed.startsWith('## ')) {
            if (currentSectionLines.length > 0) {
                sections.push({
                    title: currentSectionTitle,
                    content: currentSectionLines.join('\n').trim()
                });
            }
            currentSectionTitle = trimmed.substring(3).trim();
            currentSectionLines = [];
            continue;
        }

        currentSectionLines.push(line);
    }

    if (currentSectionLines.length > 0) {
        sections.push({
            title: currentSectionTitle,
            content: currentSectionLines.join('\n').trim()
        });
    }

    const htmlFilename = filename.replace('.md', '.html');
    const filePathUrl = `./${subjectDir}/${htmlFilename}`;

    return {
        chapterTitle,
        fileName: filename,
        filePath: filePathUrl,
        sections
    };
}

/**
 * 한 과목의 모든 챕터 MD를 파싱해 STUDY_DATA[key] 형태로 조립.
 * @param {object} subjectMeta - manifest.json subjects[] 항목 { key, order, name, dir, chapters:[{key,title,file}] }
 * @param {Record<string,string>} mdByFile - { '1.cosmetic-law.md': '<md text>', ... }
 * @param {object} [opts] - { filePathMode: 'html'|'md' } 원본 링크 경로 확장자 (기본 'md')
 * @returns {{name:string, cards:Array, quizzes:Array, chapters:Array}}
 */
export function buildSubjectData(subjectMeta, mdByFile, opts = {}) {
    const filePathMode = opts.filePathMode || 'md';
    const data = {
        name: `${subjectMeta.order}과목: ${subjectMeta.name}`,
        cards: [],
        quizzes: [],
        chapters: []
    };

    const chapters = subjectMeta.chapters || [];
    chapters.forEach(chapter => {
        const file = chapter.file;
        const md = mdByFile[file];
        if (typeof md !== 'string') {
            throw new Error(`Markdown source missing for chapter file: ${file}`);
        }

        const { cards, quizzes } = parseMarkdownFile(md, subjectMeta.key, file, chapter.key);
        data.cards.push(...cards);
        data.quizzes.push(...quizzes);

        const chapterData = parseTextbookContent(md, file, `content/${subjectMeta.dir}`);
        if (filePathMode === 'md') {
            // 원본 HTML은 제거되었으므로 링크를 .md 원문으로 변경
            chapterData.filePath = `./content/${subjectMeta.dir}/${file}`;
        }
        data.chapters.push(chapterData);
    });

    // 중복 카드 제거 (같은 chapter 내 용어 사전 표와 본문 표 간 용어 중복 대응)
    const uniqueCards = [];
    const cardMap = new Set();
    data.cards.forEach(c => {
        if (!cardMap.has(c.id)) {
            cardMap.add(c.id);
            uniqueCards.push(c);
        }
    });
    data.cards = uniqueCards;

    // 중복 퀴즈 제거 (빌드 build()와 동일 로직)
    const uniqueQuizzes = [];
    const quizMap = new Set();
    data.quizzes.forEach(q => {
        const key = `${q.question}_${q.answer}`;
        if (!quizMap.has(key)) {
            quizMap.add(key);
            uniqueQuizzes.push(q);
        }
    });
    data.quizzes = uniqueQuizzes;

    return data;
}

// 테스트/재사용을 위해 내부 함수도 노출
export { parseMarkdownFile, parseTextbookContent };
