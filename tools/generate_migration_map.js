const fs = require('fs');
const path = require('path');
const { stableId } = require('./build/id-factory');

const WORKSPACE_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(WORKSPACE_DIR, 'data', 'id_migration.js');

const manifestPath = path.join(WORKSPACE_DIR, 'content', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const SUBJECT_DIRS = manifest.subjects.map(s => ({
  id: s.key,
  name: `${s.order}과목: ${s.name}`,
  dir: `content/${s.dir}`,
  chapters: s.chapters
}));

const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/🔖기출/g, '')
    .replace(/📌중요/g, '')
    .trim();
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 맵 객체
const migrationMap = {};

const parseMarkdownFileForMigration = (filePath, subjectId, filename, chapterKey) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const filePrefixMatch = filename.match(/^(\d+)\./);
  const filePrefix = filePrefixMatch ? filePrefixMatch[1] : '0';

  let oldCardCount = 0;
  let oldQuizCount = 0;

  // #2와 동일한 신 퀴즈 ID 생성 규칙 (textbook.plugin.js의 makeQuizId와 반드시 일치).
  // 파일 단위 카운터로 term|answer(+#n) 해시 → 실제 번들의 퀴즈 ID와 매핑 타깃이 일치한다.
  const quizIdCounts = new Map();
  const makeQuizId = (term, answer) => {
    const base = `${term}|${answer}`;
    const n = (quizIdCounts.get(base) || 0) + 1;
    quizIdCounts.set(base, n);
    const input = n === 1 ? base : `${base}#${n}`;
    return stableId(subjectId, chapterKey, 'quiz', input);
  };

  let currentSection = path.basename(filename, '.md');
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

      const isKey = rawTerm.includes('🔖기출') || rawDesc.includes('🔖기출') || rawTerm.includes('📌중요') || rawDesc.includes('📌중요');

      // 1. 카드 ID 매핑
      oldCardCount++;
      const oldCardId = `${subjectId}_card_${filePrefix}_${oldCardCount}`;
      const newCardTerm = term.replace(/\*\*/g, '');
      const newCardId = stableId(subjectId, chapterKey, 'card', newCardTerm);
      migrationMap[oldCardId] = newCardId;

      // 2. 퀴즈 ID 매핑
      if (isKey) {
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
              oldQuizCount++;
              const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
              const newQuizId = makeQuizId(newCardTerm, answer);
              migrationMap[oldQuizId] = newQuizId;
            }
          });
        } else if (numMatches.length > 0) {
          numMatches.forEach(match => {
            oldQuizCount++;
            const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
            const newQuizId = makeQuizId(newCardTerm, match[0].trim());
            migrationMap[oldQuizId] = newQuizId;
          });
        } else {
          oldQuizCount++;
          const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
          const newQuizId = makeQuizId(newCardTerm, newCardTerm);
          migrationMap[oldQuizId] = newQuizId;
        }
      }
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('## ')) {
      currentSection = line.substring(3).trim();
      continue;
    }

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
        const cleanedLine = cleanText(line);
        const listMatch = line.match(/^[-*]\s+\*\*([^*]+)\*\*(?:\s*🔖기출)?\s*[:：-]\s*(.+)$/);
        if (listMatch) {
          const term = listMatch[1].trim();
          const desc = listMatch[2].trim();

          oldCardCount++;
          const oldCardId = `${subjectId}_card_${filePrefix}_${oldCardCount}`;
          const newCardId = stableId(subjectId, chapterKey, 'card', term);
          migrationMap[oldCardId] = newCardId;

          const boldMatches = [];
          let match;
          const boldRegex = /\*\*([^*]+)\*\*/g;
          while ((match = boldRegex.exec(desc)) !== null) {
            boldMatches.push(match);
          }

          if (boldMatches.length > 0) {
            boldMatches.forEach(m => {
              const ans = m[1].trim();
              oldQuizCount++;
              const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
              const newQuizId = makeQuizId(term, ans);
              migrationMap[oldQuizId] = newQuizId;
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
                oldQuizCount++;
                const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
                const newQuizId = makeQuizId(cleanedLine.substring(0, 15), ans);
                migrationMap[oldQuizId] = newQuizId;
              }
            });
          } else if (numMatches.length > 0) {
            numMatches.forEach(m => {
              oldQuizCount++;
              const oldQuizId = `${subjectId}_quiz_${filePrefix}_${oldQuizCount}`;
              const newQuizId = makeQuizId(cleanedLine.substring(0, 15), m[0].trim());
              migrationMap[oldQuizId] = newQuizId;
            });
          }
        }
      }
    }
  }

  if (inTable) {
    processTable(tableHeaders, tableRows);
  }
};

const main = () => {
  console.log('Generating migration map...');
  SUBJECT_DIRS.forEach(subj => {
    const subjPath = path.join(WORKSPACE_DIR, subj.dir);
    if (!fs.existsSync(subjPath)) return;

    const chapters = subj.chapters || [];
    chapters.forEach(chapter => {
      const file = chapter.file;
      const filePath = path.join(subjPath, file);
      if (!fs.existsSync(filePath)) return;

      parseMarkdownFileForMigration(filePath, subj.id, file, chapter.key);
    });
  });

  const outputContent = `// 자동 생성된 ID 마이그레이션 맵입니다. 수정하지 마십시오.
const ID_MIGRATION_MAP = ${JSON.stringify(migrationMap, null, 2)};
`;
  fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
  console.log(`Migration map generated! Saved to ${OUTPUT_FILE}`);
};

main();
