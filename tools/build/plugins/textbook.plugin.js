const fs = require('fs');
const path = require('path');

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

const GENERIC_SUFFIXES = [
    '기능','기준','방법','절차','조건','사항','내용','순서','단계',
    '시기','기간','횟수','위치','크기','형태','상태','수준','범위',
    '대상','원칙','방안','대책','방향','평가','제한','금지','의무',
    '책임','권리','예외','처분','제도','정책','사례','전망','비교',
    '차이','장점','단점','이유','원인','증상','치료','예방','개요',
    '필요성','의의','효과','역할','분류','원리','개념','구조','특징',
    '종류','목적','정의','관리','요건','적용','구분','일반','기본',
    '과정','결과','영향','문제','조치','배경','현황','관리방법',
];

const GENERIC_SINGLE = new Set([
    '정의','목적','종류','특징','기준','방법','관리','주의사항',
    '내용','구분','적용','원칙','개요','필요성','의의','효과',
    '요건','조건','절차','구조','역할','기능','분류','현황',
    '배경','개념','원리','방향','평가','기본','일반','사항',
    '의무','권리','책임','금지','제한','예외','범위','대상',
    '시기','기간','횟수','위치','크기','형태','상태','수준',
    '단계','순서','과정','결과','영향','문제','대책','방안',
    '조치','처분','제도','정책','사례','전망','비교','차이',
    '장점','단점','이유','원인','증상','치료','예방','안전관리',
    '관능평가',
]);

function isGenericTerm(term) {
    if (GENERIC_SINGLE.has(term)) return true;
    if (term.length <= 15) {
        for (const suffix of GENERIC_SUFFIXES) {
            if (term.endsWith(suffix) && term.length > suffix.length) return true;
        }
    }
    return false;
}

// ── 카드 타입 분류 (8가지 후보 유형) ──
function classifyCardType(term, definition, category) {
  const text = `${term} ${definition}`;
  if (/벌금|징역|과태료|벌칙|행정처분|등록취소|영업정지|폐지|처벌/.test(text)) return 'penalty';
  if (/금지|안\s*된다|수\s*없|불가|하지\s*아니|금지함/.test(text)) return 'prohibition';
  if (/예외|단,\s|제외|아니하|예외적으로/.test(text)) return 'exception';
  if (/\d+\s*(일|년|개월|회|명|%|이상|이하|미만|초과|분의|시간|도|배|g|mL|kg|mg)/.test(definition)) return 'number';
  if (/요건|조건|기준|필요|자격|구비|갖추어야/.test(text)) return 'requirement';
  if (/vs|≠|＝|구분|비교|차이|차이점|다르|해당한다|해당하지/.test(text)) return 'comparison';
  if (/절차|순서|단계|과정|신청|신고|등록|승인|보고|통보/.test(text)) return 'procedure';
  return 'definition';
}

// ── 카드 중요도 점수 (0-100) ──
function scoreCard(term, definition, isKey, category, cardType) {
  let examImportance = 50;
  if (isKey) examImportance += 30;
  if (['penalty', 'prohibition', 'exception'].includes(cardType)) examImportance += 20;
  else if (['number', 'requirement', 'comparison'].includes(cardType)) examImportance += 10;
  examImportance = Math.min(100, examImportance);

  let memorizeNeed = 50;
  if (/\d+\s*(일|년|개월|회|명|%|이상|이하|미만|초과|분의)/.test(definition)) memorizeNeed += 30;
  if (['number', 'comparison'].includes(cardType)) memorizeNeed += 20;
  if (term.length >= 3 && term.length <= 15) memorizeNeed += 10;
  memorizeNeed = Math.min(100, memorizeNeed);

  let numericScore = 0;
  if (/\d+\s*(일|년|개월|회|명|%|이상|이하|미만|초과|분의|시간|도|배)/.test(definition)) numericScore = 100;
  else if (/요건|조건|기준|필요|자격/.test(definition)) numericScore = 70;
  else if (['requirement', 'procedure'].includes(cardType)) numericScore = 50;

  let examRel = isKey ? 100 : (category && /기출/.test(category) ? 30 : 0);

  let cardFit = 70;
  if (term.length >= 3 && term.length <= 15) cardFit += 20;
  if (term.length > 30) cardFit -= 20;
  if (definition.length > 200) cardFit -= 20;
  if (definition.length < 15) cardFit -= 10;
  if (/^[•·]/.test(definition)) cardFit -= 10;
  cardFit = Math.max(0, Math.min(100, cardFit));

  let repeatValue = 60;
  if (['definition', 'comparison'].includes(cardType)) repeatValue += 20;
  if (/\*\*[^*]+\*\*/.test(definition)) repeatValue += 10;
  if (/^[•·]/.test(definition)) repeatValue -= 10;
  repeatValue = Math.max(0, Math.min(100, repeatValue));

  // 가중 합산 (정수 연산으로 부동소수점 오차 방지)
  const score = Math.round(
    (examImportance * 30 +
    memorizeNeed * 25 +
    numericScore * 15 +
    examRel * 15 +
    cardFit * 10 +
    repeatValue * 5) / 100
  );
  return Math.max(0, Math.min(100, score));
}

// ── 난이도 분류 ──
function determineDifficulty(definition, cardType) {
  if (definition.length > 150 || /^[•·]/.test(definition)) return 'hard';
  if (definition.length <= 50 && cardType === 'definition') return 'easy';
  if (/\d+/.test(definition) || definition.length > 80) return 'medium';
  return 'easy';
}

// ── 퀴즈 품질 검사 ──
function isValidQuiz(type, question, answer) {
  if (answer.length > 25) return false;
  if (/^[•·]/.test(answer)) return false;
  if (/참고\s*-/.test(answer)) return false;
  const cleanQ = question.replace(/^[•·]\s*/, '').trim();
  if (cleanQ.length < 15) return false;
  if (/^\[\s*빈칸\s*\]\.?$/i.test(cleanQ)) return false;
  return true;
}

const parseMarkdownFile = (filePath, subjectId, filename, chapterKey, stableId) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const filePrefixMatch = filename.match(/^(\d+)\./);
  const filePrefix = filePrefixMatch ? filePrefixMatch[1] : '0';

  const cards = [];
  const quizzes = [];
  const warnings = []; // #3: 🔖기출 마커가 있으나 퀴즈 미생성된 항목 수집

  // #2: 퀴즈 ID 유일화.
  // 한 용어(term)에서 복수 퀴즈(복수 빈칸)가 나올 수 있으므로 term만으로는 ID가 충돌한다.
  // 해시 입력에 answer를 결합해 빈칸별로 구분하고, 그래도 겹치면 순번(#n)을 덧붙여
  // 빌드 검증(uniqueIds)이 정상 콘텐츠를 실패로 처리하지 않도록 한다.
  // answer는 정의 본문보다 안정적이므로(빈칸 대상 토큰) 진행상황 보존에도 유리하다.
  const quizIdCounts = new Map();
  const makeQuizId = (term, answer) => {
    const base = `${term}|${answer}`;
    const n = (quizIdCounts.get(base) || 0) + 1;
    quizIdCounts.set(base, n);
    const input = n === 1 ? base : `${base}#${n}`;
    return stableId(subjectId, chapterKey, 'quiz', input);
  };

  let currentSection = path.basename(filename, '.md');
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

      // ①②③ 등 원번호 기호 및 (L숫자) 줄번호 참조 제거, 한국어 카테고리 꼴표 괄호 제거
      const cleanTerm = term.replace(/\*\*/g, '').replace(/\s*\(L\d+\)\s*/g, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '').replace(/\s*\(([^a-zA-Z()]*?)\)/g, '').trim();
      if (!cleanTerm) return;

      // 1~2자 키워드는 의미 부족으로 건너뛰기
      if (cleanTerm.length <= 2) return;

      // 50자 초과 키워드는 키워드로 부적합 (긴 문장/설명이 term에 들어간 경우)
      if (cleanTerm.length > 50) return;

      // 범용 표현(예: "기능", "시험 기준", "보관 조건")은 키워드로 부적합
      if (isGenericTerm(cleanTerm)) return;

      const has기출 = /🔖기출|🎯\s*기출/.test(rawTerm) || /🔖기출|🎯\s*기출/.test(rawDesc);
      const isKey = has기출 || /📌중요|🎯\s*중요/.test(rawTerm) || /📌중요|🎯\s*중요/.test(rawDesc);
      // definition에서도 (L숫자) 줄번호 참조 제거
      const cleanDesc = desc.replace(/\s*\(L\d+\)\s*/g, ' ').trim();

      // term과 definition이 동일하면 의미 없는 카드이므로 건너뛰기
      if (cleanTerm === cleanDesc) return;

      // definition이 '별표' 참조만 있거나 마크다운 링크만 있는 경우 건너뛰기
      if (/^별표\s*\d/.test(cleanDesc)) return;
      if (/←.*별표.*참조$/.test(cleanDesc)) return;
      if (/^\[.+\]\(.+\)$/.test(cleanDesc)) return;

      // definition이 10자 이하면 설명으로서 의미 부족 (수치/단답형)
      if (cleanDesc.length <= 10) return;

      // 카드 메타데이터 계산
      const cardType = classifyCardType(cleanTerm, cleanDesc, currentSection);
      const importance = scoreCard(cleanTerm, cleanDesc, isKey, currentSection, cardType);
      const difficulty = determineDifficulty(cleanDesc, cardType);

      // 중요도 40점 미만은 저품질 카드이므로 제거
      if (importance < 40) return;

      cards.push({
        id: stableId(subjectId, chapterKey, 'card', cleanTerm),
        category: currentSection,
        term: cleanTerm,
        definition: cleanDesc,
        isKey: isKey,
        cardType: cardType,
        importance: importance,
        difficulty: difficulty
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
              if (isValidQuiz('blank', quizText, answer)) {
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
            }
          });
        } else if (numMatches.length > 0) {
          numMatches.forEach(match => {
            const answer = match[0].trim();
            const quizText = cleanDesc.replace(new RegExp(escapeRegExp(answer), 'g'), ' [ 빈칸 ] ');
            if (isValidQuiz('blank', quizText, answer)) {
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
        } else {
          if (isValidQuiz('term', cleanDesc, cleanTerm)) {
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
        }

        // #3: 🔖기출 표시가 있는데 이 행에서 퀴즈가 하나도 안 나오면 경고 수집
        if (has기출 && quizzesForRow === 0) {
          warnings.push(cleanTerm || desc.substring(0, 40));
        }
      } else if (importance >= 50 && isValidQuiz('term', cleanDesc, cleanTerm)) {
        quizzes.push({
          id: makeQuizId(cleanTerm, cleanTerm),
          category: currentSection,
          context: `정의에 알맞은 용어를 적으시오.`,
          question: `${cleanDesc}`,
          answer: cleanTerm,
          type: 'term'
        });
      }
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('## ')) {
      currentSection = line.substring(3).trim();
      skipSection = currentSection.startsWith('🧭')
        || currentSection.startsWith('🎯 과목 시각화')
        || currentSection.startsWith('📋 별표')
        || currentSection.startsWith('📊')
        || currentSection.startsWith('🔢')
        || currentSection.startsWith('🔗')
        || currentSection.includes('데이터 구조')
        || currentSection.includes('주요 성분 데이터');
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

      if (/🔖기출|📌중요|🎯\s*기출|🎯\s*중요/.test(line)) {
        const has기출Line = /🔖기출|🎯\s*기출/.test(line);
        let quizzesForLine = 0;
        const cleanedLine = cleanText(line);
        const listMatch = line.match(/^[-*]\s+\*\*([^*]+)\*\*(?:\s*(?:🔖기출|🎯\s*기출|📌중요|🎯\s*중요))?\s*[:：-]\s*(.+)$/);
        if (listMatch) {
          const term = cleanText(listMatch[1]).replace(/\s*\(L\d+\)\s*/g, '').replace(/\s*\(([^a-zA-Z()]*?)\)/g, '').trim();
          if (term.length > 2 && term.length <= 50 && !isGenericTerm(term)) {
          const desc = listMatch[2].trim();
          const cleanDesc = cleanText(desc).replace(/\s*\(L\d+\)\s*/g, ' ').trim();
          if (term !== cleanDesc && cleanDesc.length > 10) {
          const liCardType = classifyCardType(term, cleanDesc, currentSection);
          const liImportance = scoreCard(term, cleanDesc, true, currentSection, liCardType);
          const liDifficulty = determineDifficulty(cleanDesc, liCardType);
          if (liImportance < 40) {
          } else {
          cards.push({
            id: stableId(subjectId, chapterKey, 'card', term),
            category: currentSection,
            term: term,
            definition: cleanDesc,
            isKey: true,
            cardType: liCardType,
            importance: liImportance,
            difficulty: liDifficulty
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
              const quizText = cleanDesc.replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] ');
              if (isValidQuiz('blank', quizText, ans)) {
                quizzes.push({
                  id: makeQuizId(term, ans),
                  category: currentSection,
                  context: `[주제: ${term}]`,
                  question: quizText,
                  answer: ans,
                  type: 'blank'
                });
                quizzesForLine++;
              }
            });
          }
          }
          }
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
                const quizText = cleanedLine.replace(new RegExp(`\\*\\*${escapeRegExp(ans)}\\*\\*|${escapeRegExp(ans)}`, 'g'), ' [ 빈칸 ] ');
                if (isValidQuiz('blank', quizText, ans)) {
                  quizzes.push({
                    id: makeQuizId(cleanedLine.substring(0, 15), ans),
                    category: currentSection,
                    context: `[기출 지문 빈칸 채우기]`,
                    question: quizText,
                    answer: ans,
                    type: 'blank'
                  });
                  quizzesForLine++;
                }
              }
            });
          } else if (numMatches.length > 0) {
            numMatches.forEach(m => {
              const ans = m[0].trim();
              const quizText = cleanedLine.replace(new RegExp(escapeRegExp(ans), 'g'), ' [ 빈칸 ] ');
              if (isValidQuiz('blank', quizText, ans)) {
                quizzes.push({
                  id: makeQuizId(cleanedLine.substring(0, 15), ans),
                  category: currentSection,
                  context: `[기출 지문 빈칸 채우기]`,
                  question: quizText,
                  answer: ans,
                  type: 'blank'
                });
                quizzesForLine++;
              }
            });
          }
        }

        // #3: 🔖기출 지문/리스트인데 퀴즈가 하나도 안 나오면 경고 수집 (조용한 손실 방지)
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
};

const parseTextbookContent = (filePath, filename, subjectDir) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  let chapterTitle = path.basename(filename, '.md');
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
};

module.exports = {
  name: 'textbook',
  build(subject, ctx) {
    const subjPath = path.join(ctx.workspaceDir, 'content', subject.dir);
    if (!fs.existsSync(subjPath)) {
      throw new Error(`Directory not found: ${subjPath}`);
    }

    const data = {
      name: `${subject.order}과목: ${subject.name}`,
      cards: [],
      quizzes: [],
      chapters: []
    };

    // #3: 마커 감시 경고 (빌드 산출물/해시에는 포함되지 않는 메타. index.js가 소비 후 제거)
    const markerWarnings = [];

    const chapters = subject.chapters || [];
    chapters.forEach(chapter => {
      const file = chapter.file;
      const filePath = path.join(subjPath, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const { cards, quizzes, warnings } = parseMarkdownFile(filePath, subject.key, file, chapter.key, ctx.idFactory.stableId);
      data.cards.push(...cards);
      data.quizzes.push(...quizzes);

      if (warnings && warnings.length > 0) {
        markerWarnings.push({
          file: `${subject.dir}/${file}`,
          count: warnings.length,
          samples: warnings.slice(0, 5)
        });
      }

      const chapterData = parseTextbookContent(filePath, file, `content/${subject.dir}`);
      data.chapters.push(chapterData);
    });

    // 산출물에는 섞이지 않도록 언더스코어 필드로 부착 (index.js가 delete)
    Object.defineProperty(data, '_warnings', {
      value: markerWarnings,
      enumerable: false
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

    // 중복 퀴즈 제거
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
};
