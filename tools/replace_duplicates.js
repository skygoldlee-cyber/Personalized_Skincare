#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'content', '문제은행');

// 과목2 Q88: 제모제 사용금지 대상 (L3082)
const s2Q88 = {
  qnum: 88,
  question: '### Q88. 치오글라이콜릭애씨드 함유 제모제의 사용금지 대상이 아닌 것은?\r\n① 생리 전후, 산전, 산후, 병후의 환자\r\n② 얼굴, 상처, 부스럼, 습진, 짓무름, 기타 염증, 반점 또는 자극이 있는 피부\r\n③ 유사 제품에 부작용이 나타난 적이 있는 피부\r\n④ 약한 피부 또는 남성의 수염 부위\r\n⑤ 건강한 팔·다리의 털이 있는 부위\r\n',
  answer: '**Q88.**\r\n\r\n> **정답: ⑤** [교재: L3082](<../교재/manufacturing/2과목_제조및품질관리_표준형.md#L3082>)\r\n>\r\n> **📖 교재 근거 ([L3082](<../교재/manufacturing/2과목_제조및품질관리_표준형.md#L3082>)):**\r\n> #### 제모제 🎯 기출 (치오글라이콜릭애씨드 함유 제품에만 표시함) — 사용금지: ① 생리 전후·산전·산후·병후 ② 얼굴·상처·부스럼·습진·짓무름·염증·반점·자극 피부 ③ 유사 제품 부작용 피부 ④ 약한 피부·남성 수염 부위\r\n>\r\n> **해설**: 건강한 팔·다리의 털이 있는 부위는 제모제 사용금지 대상이 아니다. 제모제는 해당 부위에 정상적으로 사용하는 제품이다.\r\n'
};

// 과목3 Q209: 안전용기·포장 대상 기준 (L2744) - 제외 대상
const s3Q209 = {
  qnum: 209,
  question: '### Q209. 안전용기·포장 기준상 안전용기·포장 대상에서 제외되는 것은?\r\n① 아세톤을 함유하는 네일 에나멜 리무버\r\n② 어린이용 오일 (탄화수소류 10% 이상, 운동점도 21cst 이하)\r\n③ 메틸살리실레이트 5.0% 이상 함유 액체 제품\r\n④ 일회용 제품 및 에어로졸 제품\r\n⑤ 네일 폴리시 리무버\r\n',
  answer: '**Q209.**\r\n\r\n> **정답: ④** [교재: L2744](<../교재/safety/3과목_유통화장품안전관리_표준형.md#L2744>)\r\n>\r\n> **📖 교재 근거 ([L2744](<../교재/safety/3과목_유통화장품안전관리_표준형.md#L2744>)):**\r\n> #### (4) 안전용기·포장 기준 🎯 기출 — ② 안전용기·포장 대상 기준: 일회용 제품, 용기 입구가 펌프 또는 방아쇠로 작동되는 분무용기, 압축 분무용기(에어로졸 제품 등)는 대상에서 **제외**\r\n>\r\n> **해설**: 일회용 제품, 펌프/방아쇠 분무용기, 에어로졸 제품은 안전용기·포장 대상에서 제외된다. 아세톤 함유 리무버, 탄화수소 10% 이상 어린이용 오일, 메틸살리실레이트 5% 이상 제품은 안전용기 대상이다.\r\n'
};

function replaceInFile(fname, replacement) {
  const fpath = path.join(baseDir, fname);
  let content = fs.readFileSync(fpath, 'utf8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const sep = `${eol}---${eol}`;
  const aMarker = `${eol}**Q`;

  // Replace question block
  const qStart = content.indexOf(`### Q${replacement.qnum}.`);
  if (qStart === -1) { console.log(`${fname} Q${replacement.qnum}: question not found`); return; }
  const qEnd = content.indexOf(sep, qStart);
  if (qEnd === -1) { console.log(`${fname} Q${replacement.qnum}: question end (sep) not found`); return; }
  console.log(`${fname} Q${replacement.qnum}: qStart=${qStart}, qEnd=${qEnd}`);
  content = content.substring(0, qStart) + replacement.question + content.substring(qEnd);

  // Replace answer block
  const aStart = content.indexOf(`**Q${replacement.qnum}.**`);
  if (aStart === -1) { console.log(`${fname} Q${replacement.qnum}: answer not found`); return; }
  const aEnd = content.indexOf(aMarker, aStart + 10);
  const aEndFinal = aEnd === -1 ? content.length : aEnd;
  console.log(`${fname} Q${replacement.qnum}: aStart=${aStart}, aEnd=${aEnd}`);
  content = content.substring(0, aStart) + replacement.answer + content.substring(aEndFinal);

  fs.writeFileSync(fpath, content, 'utf8');
  console.log(`${fname} Q${replacement.qnum}: replaced ✅`);
}

replaceInFile('과목2_문제은행_교재인용.md', s2Q88);
replaceInFile('과목3_문제은행_교재인용.md', s3Q209);

console.log('\nDuplicate replacement complete.');
