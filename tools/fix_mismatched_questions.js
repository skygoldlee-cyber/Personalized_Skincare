#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content', '문제은행');

// Helper: build MC answer block
function answerMC(qnum, answer, line, txPath, evidence, explanation) {
  return `**Q${qnum}.**

> **정답: ${answer}** [교재: L${line}](<${txPath}#L${line}>)
>
> **📖 교재 근거 ([L${line}](<${txPath}#L${line}>)):**
> ${evidence}
>
> **해설**: ${explanation}
`;
}

// Helper: build SA answer block
function answerSA(qnum, answer, allowed, line, txPath, evidence) {
  let block = `**Q${qnum}.**

> **정답: ${answer}** [교재: L${line}](<${txPath}#L${line}>)`;
  if (allowed) {
    block += `\n>\n> **허용 정답:** ${allowed}`;
  }
  block += `\n>\n> **📖 교재 근거 ([L${line}](<${txPath}#L${line}>)):**
> ${evidence}
`;
  return block;
}

// Helper: build question block
function questionMC(qnum, text, choices) {
  let block = `### Q${qnum}. ${text}\n`;
  for (let i = 0; i < choices.length; i++) {
    block += `${'①②③④⑤'[i]} ${choices[i]}\n`;
  }
  return block;
}

function questionSA(qnum, text) {
  return `### Q${qnum}. ${text}\n`;
}

// === 과목1 replacements ===
const s1Path = '../교재/law/1과목_화장품법의이해_표준형.md';
const s1Replacements = [
  // Q46: 기능성화장품 정의 (L521)
  {
    qnum: 46,
    question: questionMC(46, '화장품법상 「기능성화장품」에 대한 설명으로 옳은 것은?', [
      '기능성화장품은 일반화장품과 동일한 기준으로 관리된다',
      '기능성화장품은 총리령으로 정하는 화장품을 말한다',
      '기능성화장품은 의약품으로 분류된다',
      '기능성화장품은 인체에 대한 작용이 경미하지 않아도 된다',
      '기능성화장품은 모든 화장품을 포함한다',
    ]),
    answer: answerMC(46, '②', 521, s1Path,
      '| **기능성화장품** 🎯 기출 | 화장품 중에서 다음 어느 하나에 해당되는 것으로서 **총리령으로 정하는 화장품**을 말함 |',
      '기능성화장품은 화장품 중에서 총리령으로 정하는 특정 효능·효과를 가진 화장품을 말한다.'),
  },
  // Q47: 안전관리 기준 (L811)
  {
    qnum: 47,
    question: questionMC(47, '화장품책임판매업자의 안전관리 기준에 대한 설명으로 옳지 않은 것은?', [
      '책임판매관리자를 두어야 한다',
      '안전관리 정보를 수집·기록해야 한다',
      '안전확보 조치계획을 화장품책임판매업자에게 문서로 보고해야 한다',
      '안전관리 정보의 검토 결과 조치가 필요한 경우 회수, 폐기 등의 조치를 취해야 한다',
      '안전관리 기준은 자율적으로 설정하므로 보고 의무가 없다',
    ]),
    answer: answerMC(47, '⑤', 811, s1Path,
      '#### 안전관리 기준 🎯 기출 (책임판매업자: 조직·인원 구성, 정보 수집, 안전확보 조치·실시, 업무 총괄)',
      '화장품책임판매업자는 책임판매관리자를 두어 안전관리 정보를 수집·기록하고, 안전확보 조치를 문서로 보고해야 한다. 보고 의무가 없다는 것은 옳지 않다.'),
  },
  // Q54: 품질검사 위탁 기관 (L753)
  {
    qnum: 54,
    question: questionMC(54, '화장품 제조업의 품질검사를 위탁할 수 있는 기관이 아닌 것은?', [
      '보건환경연구원',
      '시험실을 갖춘 제조업자',
      '「식품·의약품 분야 시험·검사 등에 관한 법률」에 따른 화장품시험·검사기관',
      '한국의약품수출입협회',
      '한국화장품협회',
    ]),
    answer: answerMC(54, '⑤', 753, s1Path,
      '> **참고: 품질검사 위탁 기관** 🎯 기출 - 보건환경연구원 - 시험실을 갖춘 제조업자 - 「식품·의약품 분야 시험·검사 등에 관한 법률」에 따른 화장품시험·검사기관 - 한국의약품수출입협회',
      '한국화장품협회는 품질검사 위탁 기관에 해당하지 않는다.'),
  },
  // Q59: 화장품의 정의 (L520)
  {
    qnum: 59,
    question: questionMC(59, '화장품법상 「화장품」의 정의에 대한 설명으로 옳지 않은 것은?', [
      '인체를 청결·미화하여 매력을 더하고 용모를 밝게 변화시키는 목적의 물품이다',
      '피부·모발의 건강을 유지 또는 증진하기 위해 사용되는 물품이다',
      '인체에 바르고 문지르거나 뿌리는 등의 방법으로 사용된다',
      '인체에 대한 작용이 경미한 것을 말한다',
      '의약품 및 의약외품을 포함한다',
    ]),
    answer: answerMC(59, '⑤', 520, s1Path,
      '| **화장품** 🎯 기출 | 인체를 청결·미화하여 매력을 더하고 용모를 밝게 변화시키거나 피부·모발의 건강을 유지 또는 증진하기 위해 인체에 바르고 문지르거나 뿌리는 등 이와 유사한 방법으로 사용되는 물품으로서 인체에 대한 작용이 경미한 것을 말함 (단, **의약품, 의약외품 제외**) |',
      '화장품의 정의에서 의약품과 의약외품은 명시적으로 제외된다.'),
  },
  // Q75: 체모제거용 제품류 (L576)
  {
    qnum: 75,
    question: questionMC(75, '화장품법 시행규칙상 「체모제거용 제품류」에 해당하는 것은?', [
      '샴푸·린스',
      '제모제·제모왁스',
      '데오도런트',
      '향수·콜로뉴',
      '로션·크림',
    ]),
    answer: answerMC(75, '②', 576, s1Path,
      '| **체모제거용 제품류** 🎯 기출 | 몸에 난 털을 제거할 때 사용하는 제품<br>• **제모제**(기능성화장품) • **제모왁스** • 그 밖의 체모제거용 제품류 |',
      '체모제거용 제품류에는 제모제(기능성화장품)와 제모왁스 등이 포함된다.'),
  },
  // Q87: 개인정보 수집 (L2072)
  {
    qnum: 87,
    question: questionMC(87, '개인정보 보호법상 개인정보를 수집할 수 있는 경우가 아닌 것은?', [
      '정보주체의 동의를 받은 경우 (14세 미만은 법정대리인 동의 필요)',
      '법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위해 불가피한 경우',
      '공공기관이 법령 등에 의해 업무를 수행하기 위해 불가피한 경우',
      '정보주체와 체결한 계약을 이행하기 위해 필요한 경우',
      '영리 목적의 제3자 판매를 위해 자유롭게 수집하는 경우',
    ]),
    answer: answerMC(87, '⑤', 2072, s1Path,
      '### (1) 개인정보 수집이 가능한 경우 🎯 기출 (① 동의 ② 법령상 의무 ③ 공공기관 업무 ④ 계약 이행 ⑤ 급박한 생명·신체·재산 ⑥ 정당한 이익)',
      '영리 목적의 제3자 판매를 위한 자유로운 수집은 개인정보 수집 사유에 해당하지 않는다.'),
  },
];

// === 과목2 replacements ===
const s2Path = '../교재/manufacturing/2과목_제조및품질관리_표준형.md';
const s2Replacements = [
  // Q154: 반제품 (L2106)
  {
    qnum: 154,
    question: questionMC(154, '맞춤형화장품의 혼합에 사용되는 「반제품」에 대한 설명으로 옳은 것은?', [
      '충전(1차 포장) 이전의 제조 단계까지 끝낸 화장품이다',
      '제조공정 단계에 있는 것으로서 필요한 제조공정을 더 거쳐야 벌크 제품이 되는 것이다',
      '완제품과 동일한 의미이다',
      '원료와 혼합하여 바로 사용할 수 있는 완성품이다',
      '수입화장품만을 의미한다',
    ]),
    answer: answerMC(154, '②', 2106, s2Path,
      '| 반제품 | 제조공정 단계에 있는 것으로서 필요한 제조공정을 더 거쳐야 벌크 제품이 되는 것 🎯 기출 |',
      '반제품은 제조공정 단계에 있는 것으로, 필요한 제조공정을 더 거쳐야 벌크 제품이 되는 것이다. 벌크제품은 충전(1차 포장) 이전의 제조 단계까지 끝낸 화장품이다.'),
  },
];

// === 과목3 replacements ===
const s3Path = '../교재/safety/3과목_유통화장품안전관리_표준형.md';
const s3Replacements = [
  // Q8: 손 소독제 특징 (L1328)
  {
    qnum: 8,
    question: questionMC(8, '작업장 내 직원의 손 소독에 사용되는 「손 소독제」에 대한 설명으로 옳지 않은 것은?', [
      '1차 에탄올이 함유되어 세정 효과가 있다',
      '물 없이도 손 소독이 가능하다',
      '의약외품으로 분류된다',
      '알코올, 클로르헥시딘, 헥사클로로펜, 아이오도퍼 등이 사용된다',
      '일반 비누와 동일하게 흐르는 물에 사용해야 한다',
    ]),
    answer: answerMC(8, '⑤', 1328, s3Path,
      '| **손 소독제** 🎯 **기출** | 1차 에탄올이 함유되어 세정 효과가 있음 · 물 없이도 손 소독이 가능하며, **의약외품으로 분류됨** · 알코올, 클로르헥시딘, 헥사클로로펜, 아이오도퍼 등 | 손 소독제로 소독 |',
      '손 소독제는 물 없이도 사용이 가능하며, 일반 비누(손 세정제)와는 다르다. 손 세정제는 흐르는 물에 비누를 사용하여 세척하는 것이고, 손 소독제는 별도의 물 없이도 소독이 가능하다.'),
  },
  // Q68: 손 소독제 성분 (L1328)
  {
    qnum: 68,
    question: questionMC(68, '다음 중 작업장 내 직원의 손 소독에 사용되는 손 소독제의 성분이 아닌 것은?', [
      '알코올',
      '클로르헥시딘',
      '헥사클로로펜',
      '아이오도퍼',
      '과망간산칼륨',
    ]),
    answer: answerMC(68, '⑤', 1328, s3Path,
      '| **손 소독제** 🎯 **기출** | 1차 에탄올이 함유되어 세정 효과가 있음 · 물 없이도 손 소독이 가능하며, **의약외품으로 분류됨** · **알코올, 클로르헥시딘, 헥사클로로펜, 아이오도퍼** 등 | 손 소독제로 소독 |',
      '손 소독제의 성분은 알코올, 클로르헥시딘, 헥사클로로펜, 아이오도퍼 등이다. 과망간산칼륨은 손 소독제 성분이 아니다.'),
  },
  // Q233: 손 소독제 분류 (L1328) - 단답형
  {
    qnum: 233,
    question: questionSA(233, '작업장 내 직원의 손 소독에 사용되는 손 소독제는 법령상 **[  (A)  ]**으로 분류된다.'),
    answer: answerSA(233, '의약외품', '의약 외품, 의약외품', 1328, s3Path,
      '| **손 소독제** 🎯 **기출** | 1차 에탄올이 함유되어 세정 효과가 있음 · 물 없이도 손 소독이 가능하며, **의약외품으로 분류됨** · 알코올, 클로르헥시딘, 헥사클로로펜, 아이오도퍼 등 | 손 소독제로 소독 |'),
  },
];

// === Replace function ===
function replaceInFile(fname, replacements) {
  const fpath = path.join(baseDir, fname);
  let content = fs.readFileSync(fpath, 'utf8');
  let count = 0;

  for (const r of replacements) {
    // Replace question block
    const qStart = content.indexOf(`### Q${r.qnum}.`);
    if (qStart === -1) { console.log(`${fname} Q${r.qnum}: question not found`); continue; }
    const qEnd = content.indexOf('\n---\n', qStart);
    if (qEnd === -1) { console.log(`${fname} Q${r.qnum}: question end not found`); continue; }
    
    content = content.substring(0, qStart) + r.question + content.substring(qEnd);

    // Replace answer block
    const aStart = content.indexOf(`**Q${r.qnum}.**`);
    if (aStart === -1) { console.log(`${fname} Q${r.qnum}: answer not found`); continue; }
    const aEnd = content.indexOf('\n**Q', aStart + 10);
    const aEndFinal = aEnd === -1 ? content.length : aEnd;
    
    content = content.substring(0, aStart) + r.answer + content.substring(aEndFinal);
    
    count++;
    console.log(`${fname} Q${r.qnum}: replaced`);
  }

  fs.writeFileSync(fpath, content, 'utf8');
  console.log(`${fname}: ${count}/${replacements.length} replaced`);
}

replaceInFile('과목1_문제은행_교재인용.md', s1Replacements);
replaceInFile('과목2_문제은행_교재인용.md', s2Replacements);
replaceInFile('과목3_문제은행_교재인용.md', s3Replacements);

console.log('\nAll replacements complete.');
