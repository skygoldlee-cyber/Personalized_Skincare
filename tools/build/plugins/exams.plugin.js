const fs = require('fs');
const path = require('path');

const parseExamFile = (filePath, examId, examTitle) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const questionsMap = {};
  const answersMap = {};

  let currentQuestion = null;
  let isParsingAnswers = false;

  const qHeaderRegex = /^###\s+Q(\d+)\.\s*(.*)/i;
  const qHeaderAltRegex = /^###\s+Q(\d+)[:：]?\s*(.*)/i;
  const optionRegex = /^([①②③④⑤])\s*(.*)/;
  
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
          currentQuestion.type = 'choice';
        } else if (line.length > 0 && !line.startsWith('---') && !line.startsWith('##') && !line.startsWith('*   **답안 작성란**')) {
          if (!currentQuestion.question.includes(line)) {
            currentQuestion.question += '\n' + line;
          }
        }
      }
    } else {
      let ansMatch = line.match(ansRegex1) || line.match(ansRegex2) || line.match(ansRegex3) || line.match(ansRegex4) || line.match(ansRegexAlt);
      if (ansMatch) {
        const qNum = parseInt(ansMatch[1]);
        let rawAnswer = ansMatch[2].trim().replace(/\*\*/g, '').replace(/[:：]/g, '').trim();
        
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

  const questionsList = [];
  Object.keys(questionsMap).forEach(numStr => {
    const num = parseInt(numStr);
    const q = questionsMap[num];
    const ansData = answersMap[num];

    if (ansData) {
      q.answer = ansData.answer;
      q.explanation = ansData.explanation || '별도의 상세 해설이 제공되지 않습니다.';
    }
    
    if (q.type === 'ox' && q.options.length === 0) {
      q.options = ['O', 'X'];
    }

    if (q.type === 'blank') {
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

module.exports = {
  name: 'exams',
  build(exam, ctx) {
    const filePath = path.join(ctx.workspaceDir, 'content', 'exams', exam.file);
    return parseExamFile(filePath, exam.key, exam.title);
  }
};
