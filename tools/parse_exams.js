const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.resolve(__dirname, '..');
const EXAMS_DIR = path.join(WORKSPACE_DIR, 'exams');
// 디렉토리를 탐색하여 subject*.md 파일 목록을 동적으로 빌드
const manifestPath = path.join(WORKSPACE_DIR, 'content', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const EXAM_FILES = manifest.exams.map(e => {
  const subjectMap = {
    'law': 1,
    'manufacturing': 2,
    'safety': 3,
    'understanding': 4
  };
  const s = subjectMap[e.subject] || 99;
  const p = e.part || 1;
  return {
    id: e.key,
    file: e.file,
    title: e.title,
    subjectNum: s,
    partNum: p
  };
});

// 정렬: 과목 번호순, 파트 번호순
EXAM_FILES.sort((a, b) => {
  if (a.subjectNum !== b.subjectNum) return a.subjectNum - b.subjectNum;
  return a.partNum - b.partNum;
});

const OUTPUT_FILE = path.join(WORKSPACE_DIR, 'data', 'exam_data.js');

const parseExamFile = (filePath, examId, examTitle) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const questionsMap = {};
  const answersMap = {};

  let currentQuestion = null;
  let isParsingAnswers = false;

  // 정규식 정의
  const qHeaderRegex = /^###\s+Q(\d+)\.\s*(.*)/i;
  const qHeaderAltRegex = /^###\s+Q(\d+)[:：]?\s*(.*)/i;
  const optionRegex = /^([①②③④⑤])\s*(.*)/;
  
  // 정답 파트 정규식
  const ansRegex1 = /^\*\s+\*\*Q(\d+)\.\s*정답\s*:\s*([^\*]+)\*\*/i;
  const ansRegex2 = /^\*\s+\*\*Q(\d+)\*\*\s*:\s*([^\*]+)/i;
  const ansRegex3 = /^\*\s+\*\*Q(\d+)\.\s*정답\s*:\s*([^\s\*]+)/i;
  const ansRegex4 = /^\*\s+\*\*Q(\d+)\*\*\s*정답\s*:\s*([^\s\*]+)/i;
  const ansRegexAlt = /^\*\s+\*\*Q(\d+)\*\*[:：]?\s*(.*)/i;
  const explanationRegex = /^\s*\*\s+\*해설\*[:：]?\s*(.*)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('정답 및 해설') || line.includes('정답 및 해설편') || line.includes('💡 [정답 및 해설')) {
      isParsingAnswers = true;
      continue;
    }

    if (!isParsingAnswers) {
      // 1. 문제 파트 파싱
      let match = line.match(qHeaderRegex) || line.match(qHeaderAltRegex);
      if (match) {
        const qNum = parseInt(match[1]);
        const qText = match[2].trim();
        
        let type = 'blank';
        if (line.includes('[객관식]') || qText.includes('가장 옳은 것') || qText.includes('가장 옳지 않은 것') || qText.includes('해당하지 않는 것') || qText.includes('해당하는 것')) {
          type = 'choice';
        } else if (line.includes('[단답형]') || qText.includes('빈칸') || qText.includes('알맞은')) {
          type = 'blank';
        } else if (qText.includes('(O / X)') || line.includes('OX 퀴즈') || qNum >= 71 && qNum <= 100 || qNum >= 171 && qNum <= 200 || qNum >= 271 && qNum <= 300) {
          type = 'ox';
        }

        currentQuestion = {
          id: `${examId}_q${qNum}`,
          num: qNum,
          type: type,
          question: qText.replace(/^\[객관식\]\s*/i, '').replace(/^\[단답형\]\s*/i, ''),
          options: [],
          answer: '',
          explanation: ''
        };
        questionsMap[qNum] = currentQuestion;
        continue;
      }

      if (currentQuestion) {
        let optMatch = line.match(optionRegex);
        if (optMatch) {
          currentQuestion.options.push(optMatch[2].trim());
          currentQuestion.type = 'choice'; // 선지가 발견되면 무조건 객관식
        } else if (line.length > 0 && !line.startsWith('---') && !line.startsWith('##') && !line.startsWith('*   **답안 작성란**')) {
          // 문제 설명 덧붙이기
          if (!currentQuestion.question.includes(line)) {
            currentQuestion.question += '\n' + line;
          }
        }
      }
    } else {
      // 2. 정답 및 해설 파트 파싱
      let ansMatch = line.match(ansRegex1) || line.match(ansRegex2) || line.match(ansRegex3) || line.match(ansRegex4) || line.match(ansRegexAlt);
      if (ansMatch) {
        const qNum = parseInt(ansMatch[1]);
        let rawAnswer = ansMatch[2].trim().replace(/\*\*/g, '').replace(/[:：]/g, '').trim();
        
        // 정답 정돈 (예: "(A) 3" 또는 "③" 등)
        answersMap[qNum] = {
          answer: rawAnswer,
          explanation: ''
        };
        currentQuestion = answersMap[qNum];
        continue;
      }

      if (currentQuestion) {
        let expMatch = line.match(explanationRegex);
        if (expMatch) {
          currentQuestion.explanation = expMatch[1].trim();
        } else if (line.startsWith('*') || line.startsWith('-') || (line.length > 0 && !line.includes('Q') && !line.startsWith('##') && !line.startsWith('---'))) {
          // 해설 여러줄 병합
          const cleanedLine = line.replace(/^\*+\s*/, '').replace(/^-+\s*/, '').replace(/^\s*\*해설\*[:：]?\s*/i, '').trim();
          if (currentQuestion.explanation) {
            currentQuestion.explanation += '\n' + cleanedLine;
          } else {
            currentQuestion.explanation = cleanedLine;
          }
        }
      }
    }
  }

  // 문제 정보와 정답 결합
  const questionsList = [];
  Object.keys(questionsMap).forEach(numStr => {
    const num = parseInt(numStr);
    const q = questionsMap[num];
    const ansData = answersMap[num];

    if (ansData) {
      q.answer = ansData.answer;
      q.explanation = ansData.explanation || '별도의 상세 해설이 제공되지 않습니다.';
    }
    
    // 만약 OX 퀴즈타입이면 기본 선지 제공
    if (q.type === 'ox' && q.options.length === 0) {
      q.options = ['O', 'X'];
    }

    // 빈칸/단답형 정답 클렌징
    if (q.type === 'blank') {
      // "(A) 3, (B) 5" 형태에서 정답 매칭을 유연하게 할 수 있도록 가공
      q.answerRaw = q.answer;
    }

    questionsList.push(q);
  });

  return {
    id: examId,
    title: examTitle,
    questions: questionsList.sort((a, b) => a.num - b.num)
  };
};

console.log('Compiling Exam Markdown to JS...');

const compiledData = {};
EXAM_FILES.forEach(item => {
  const filePath = path.join(EXAMS_DIR, item.file);
  const examData = parseExamFile(filePath, item.id, item.title);
  if (examData) {
    compiledData[item.id] = examData;
    console.log(`Parsed ${item.title}: ${examData.questions.length} questions.`);
  }
});

const outputContent = `// Auto-generated Exam Database for Customized Cosmetics Exam
const EXAM_DATA = ${JSON.stringify(compiledData, null, 2)};
`;

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');
console.log(`Success! Exam Database written to ${OUTPUT_FILE}`);
