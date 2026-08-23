const fs = require('fs');
const path = require('path');
const { stableId } = require('./build/id-factory');

const WORKSPACE_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(WORKSPACE_DIR, 'data', 'study_data.js');

// manifest.json을 로드하여 SUBJECT_DIRS 구성
const manifestPath = path.join(WORKSPACE_DIR, 'content', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const SUBJECT_DIRS = manifest.subjects.map(s => ({
  id: s.key,
  name: `${s.order}과목: ${s.name}`,
  dir: `content/${s.dir}`,
  chapters: s.chapters
}));

// 정규식 패턴 정의
const NUMERIC_PATTERN = /\b\d+(?:\.\d+)?(?:%|세 이하|세 이상|개월|일|년|배|종|가지|개|시간|g|ml|kg|℃|도|분|초|주|ppm|㎛|회\/hr|개\/hr|개\/㎥)\b/g;
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;

// 문자열에서 HTML 태그 제거 및 정돈
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/🔖기출/g, '')
    .replace(/📌중요/g, '')
    .trim();
};

// 마크다운 파싱 함수
const parseMarkdownFile = (filePath, subjectId, filename, chapterKey) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const filePrefixMatch = filename.match(/^(\d+)\./);
  const filePrefix = filePrefixMatch ? filePrefixMatch[1] : '0';

  const cards = [];
  const quizzes = [];

  let currentSection = path.basename(filename, '.md');
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  const processTable = (headers, rows) => {
    if (rows.length === 0) return;

    // 헤더에 '종류', '구분', '유형', '원료' 등이 있고 '설명', '정의', '기준' 등이 있는 표 분석
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

      // 플래시카드 생성
      cards.push({
        id: stableId(subjectId, chapterKey, 'card', term.replace(/\*\*/g, '')),
        category: currentSection,
        term: term.replace(/\*\*/g, ''),
        definition: desc,
        isKey: isKey
      });

      // 기출 문장 퀴즈 자동 생성 (수치 중심 또는 굵은 글씨 빈칸 뚫기)
      if (isKey) {
        // 굵은 글씨가 있으면 그것을 정답 후보로
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
              const quizText = desc.replace(new RegExp(`\\*\\*${escapeRegExp(answer)}\\*\\*|${escapeRegExp(answer)}`, 'g'), ' [ 빈칸 ] ');
              quizzes.push({
                id: stableId(subjectId, chapterKey, 'quiz', term.replace(/\*\*/g, '')),
                category: currentSection,
                context: `[용어: ${term}]`,
                question: quizText,
                answer: answer,
                type: 'blank'
              });
            }
          });
        } else if (numMatches.length > 0) {
          numMatches.forEach(match => {
            const answer = match[0].trim();
            const quizText = desc.replace(new RegExp(escapeRegExp(answer), 'g'), ' [ 빈칸 ] ');
            quizzes.push({
              id: stableId(subjectId, chapterKey, 'quiz', term.replace(/\*\*/g, '')),
              category: currentSection,
              context: `[용어: ${term}]`,
              question: quizText,
              answer: answer,
              type: 'blank'
            });
          });
        } else {
          // 마땅한 빈칸 대상이 없으면 OX 혹은 단답형 질문 생성 (단순 정의 묻기)
          quizzes.push({
            id: stableId(subjectId, chapterKey, 'quiz', term.replace(/\*\*/g, '')),
            category: currentSection,
            context: `정의에 알맞은 용어를 적으시오.`,
            question: `${desc}`,
            answer: term.replace(/\*\*/g, ''),
            type: 'term'
          });
        }
      }
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 섹션 헤더 트래킹
    if (line.startsWith('## ')) {
      currentSection = line.substring(3).trim();
      continue;
    }

    // 표 파싱 감지
    if (line.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split('|').map(h => h.trim()).filter(h => h !== '');
        tableRows = [];
        // 구분선 줄(예: |---|---|)은 건너뛰기
        if (i + 1 < lines.length && lines[i + 1].trim().includes('---')) {
          i++; // 구분선 스킵
        }
      } else {
        const rowCells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => {
          // 양 끝의 빈 셀 제외
          return idx > 0 && idx < arr.length - 1;
        });
        if (rowCells.length > 0) {
          tableRows.push(rowCells);
        }
      }
    } else {
      if (inTable) {
        processTable(tableHeaders, tableRows);
        inTable = false;
      }

      // 일반 줄에서 기출 퀴즈 및 카드 추출
      if (line.includes('🔖기출') || line.includes('📌중요')) {
        const cleanedLine = cleanText(line);
        // 리스트형 패턴 파싱: `- **항목**: 설명`
        const listMatch = line.match(/^[-*]\s+\*\*([^*]+)\*\*(?:\s*🔖기출)?\s*[:：-]\s*(.+)$/);
        if (listMatch) {
          const term = listMatch[1].trim();
          const desc = listMatch[2].trim();
          cards.push({
            id: stableId(subjectId, chapterKey, 'card', term),
            category: currentSection,
            term: term,
            definition: cleanText(desc),
            isKey: true
          });

          // 빈칸 생성
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
                id: stableId(subjectId, chapterKey, 'quiz', term),
                category: currentSection,
                context: `[주제: ${term}]`,
                question: cleanText(desc).replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] '),
                answer: ans,
                type: 'blank'
              });
            });
          }
        } else {
          // 단순 중요 문장에 대한 빈칸 뚫기 퀴즈
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
                  id: stableId(subjectId, chapterKey, 'quiz', cleanedLine.substring(0, 15)),
                  category: currentSection,
                  context: `[기출 지문 빈칸 채우기]`,
                  question: cleanedLine.replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] '),
                  answer: ans,
                  type: 'blank'
                });
              }
            });
          } else if (numMatches.length > 0) {
            numMatches.forEach(m => {
              const ans = m[0].trim();
              quizzes.push({
                id: stableId(subjectId, chapterKey, 'quiz', cleanedLine.substring(0, 15)),
                category: currentSection,
                context: `[기출 지문 빈칸 채우기]`,
                question: cleanedLine.replace(new RegExp(escapeRegExp(ans), 'g'), ' [ 빈칸 ] '),
                answer: ans,
                type: 'blank'
              });
            });
          }
        }
      }
    }
  }

  // 마지막 표 처리
  if (inTable) {
    processTable(tableHeaders, tableRows);
  }

  return { cards, quizzes };
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 교재 본문 파싱 함수
const parseTextbookContent = (filePath, filename, subjectDir) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  let chapterTitle = path.basename(filename, '.md');
  const sections = [];
  
  let currentSectionTitle = '개요';
  let currentSectionLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# ')) {
      chapterTitle = trimmed.substring(2).trim();
      continue;
    }
    
    if (trimmed.startsWith('## ')) {
      // 이전 섹션 저장
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
  
  // 마지막 섹션 저장
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
};

// 메인 실행 로직
const main = () => {
  console.log('데이터 파싱 시작...');
  const resultData = {};

  SUBJECT_DIRS.forEach(subj => {
    const subjPath = path.join(WORKSPACE_DIR, subj.dir);
    if (!fs.existsSync(subjPath)) {
      console.warn(`경고: ${subjPath} 디렉토리가 존재하지 않습니다.`);
      return;
    }

    resultData[subj.id] = {
      name: subj.name,
      cards: [],
      quizzes: [],
      chapters: []
    };

    const chapters = subj.chapters || [];
    chapters.forEach(chapter => {
      const file = chapter.file;
      const filePath = path.join(subjPath, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`경고: 파일이 없습니다: ${filePath}`);
        return;
      }
      const { cards, quizzes } = parseMarkdownFile(filePath, subj.id, file, chapter.key);
      resultData[subj.id].cards.push(...cards);
      resultData[subj.id].quizzes.push(...quizzes);

      // 교재 본문 추출 추가
      const chapterData = parseTextbookContent(filePath, file, subj.dir);
      resultData[subj.id].chapters.push(chapterData);
    });

    // 중복 퀴즈 제거 (질문과 정답이 동일한 경우)
    const uniqueQuizzes = [];
    const quizMap = new Set();
    resultData[subj.id].quizzes.forEach(q => {
      const key = `${q.question}_${q.answer}`;
      if (!quizMap.has(key)) {
        quizMap.add(key);
        uniqueQuizzes.push(q);
      }
    });
    resultData[subj.id].quizzes = uniqueQuizzes;

    console.log(`- ${subj.name}: 카드 ${resultData[subj.id].cards.length}개, 퀴즈 ${resultData[subj.id].quizzes.length}개, 단원 ${resultData[subj.id].chapters.length}개 추출 완료.`);
  });

  // JS 형식으로 파일 출력
  const outputContent = `// 자동 생성된 학습 데이터 파일입니다. 수정하지 마십시오.\nconst STUDY_DATA = ${JSON.stringify(resultData, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
  console.log(`파싱 완료! 결과가 ${OUTPUT_FILE}에 저장되었습니다.`);
};

main();
