/* ============================================================
 * tools/build/ref-statements.js
 * ------------------------------------------------------------
 * content/참조자료/ref_md/*.md (법령·고시·별표 원문)에서 합답형
 * 진술 원자를 추출한다. 법령 텍스트는 구조가 참/거짓을 보장한다:
 *
 *   def  — 정의조항: `"X"이란/은/는 …을 말한다` 항목.
 *          참 = 원문 그대로, 거짓 = 같은 조의 다른 용어 정의와 교차 결합
 *          (정의는 용어별 유일 → 교차 결합은 확실히 거짓)
 *   enum — 열거 목록: `다음 각 호/목` + 호(1. 2.)/목(가. 나.) 항목들.
 *          참 = 목록의 실제 멤버, 거짓 = 다른 목록의 멤버 (유한집합)
 *
 * 추출 원자 형태:
 *   { kind:'def'|'enum', text, docShort, article, term?, listId?, topic? }
 *
 * 사용: const { extractRefAtoms } = require('./ref-statements.js');
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

/* ---------- 문서 → 과목 귀속 규칙 (references.json referenceFiles 기준) ---------- */
const DOC_SUBJECT_RULES = [
  [/화장품법\(법률\)|화장품법 시행규칙|시행규칙_별표/, 1],
  [/개인정보/, 1],
  [/안전기준|우수화장품|CGMP|색소/, 2],
  [/KFCC|기능성화장품/, 2],
  [/주의사항|알레르기/, 4],
];

/* ---------- 정규식 ---------- */
const ART_RE = /^제(\d+)조(?:의(\d+))?\(([^)]*)\)/;   // 제2조(정의) / 제3조의2(…)
const HO_RE = /^(\d+(?:의\d+)?)\.\s*(.*)$/;          // 호 항목: 1. / 3의2.
const MOK_RE = /^([가-하])\.\s*(.*)$/;               // 목 항목: 가. 나. 다.
const ENUM_MARK_RE = /다음 각 (호|목)|다음과 같/;
// 정의 항목은 항목 "시작" 위치에서만 인정 (문장 중간 인용 용어 오인 방지)
const DEF_RE = /^[①-⑩\s]*["'“]([^"'”()]{1,25})["'”]\s*(이란|이라 함은|이라고 함은|은|는)\s*(.+?)\s*(을|를)?\s*(말한다|의미한다|뜻한다|말하는 것이다)\.?$/;
const REVISION_RE = /<(개정|신설|전문개정|삭제)[^>]*>/g;
// 줄 끝이 조사·어미·구두점이면 단어 경계 → 공백 병합, 아니면 중간 절단 → 무공백 병합
const WORD_BOUNDARY_END_RE = /(는|은|을|를|이|가|의|에|에서|로|으로|와|과|도|만|및|까지|부터|다|음|함|임|됨|까|나|요|고|며|면|서|거나|든지|라도|조차|마저|뿐|처럼|같이|대로|마다|보다|하여|하여야|하고|해야|인|한|할|된|되는|하며|하지|없이|있이|란|,|\.|·|:|;|\)|」|』|”)$/;

/** 문서 표지 이름 → 짧은 인용 라벨 (예: '화장품법(법률)(제20901호)' → '화장품법') */
function docShortName(dirName) {
  return dirName.replace(/\(.*$/, '').replace(/_/g, ' ').trim();
}

/** PDF 변환 시 공백이 소실된 문서(별표 등)는 진술로 쓸 수 없어 제외 */
function isSpaceless(text) {
  const sample = text.slice(0, 20000);
  return sample.length > 0 && (sample.match(/ /g) || []).length / sample.length < 0.07;
}

/** dirName → 과목 번호 (규칙 미일치 시 null) */
function docSubject(dirName) {
  for (const [re, s] of DOC_SUBJECT_RULES) if (re.test(dirName)) return s;
  return null;
}

/** 조문 번호 조합: 제3조의2 → '제3조의2' */
function artLabel(m) { return `제${m[1]}조${m[2] ? `의${m[2]}` : ''}`; }

/**
 * 한 문서를 조문 세그먼트로 파싱.
 * 목차 영역의 bare heading(`제N조(제목)` 만 있는 줄)은 세그먼트가 비어 자연 탈락한다.
 * 반환: [{art:'제2조', title:'정의', blocks:[{level:'para'|'ho'|'mok',no,text}]]}
 */
function parseArticles(lines) {
  const articles = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const am = line.match(ART_RE);
    if (am) {
      cur = { art: artLabel(am), title: am[3].trim(), blocks: [] };
      articles.push(cur);
      const rest = line.slice(am[0].length).trim();
      if (rest) cur.blocks.push({ level: 'para', no: '', text: rest });
      continue;
    }
    if (!cur || !line) continue;
    const hm = line.match(HO_RE);
    if (hm) { cur.blocks.push({ level: 'ho', no: hm[1], text: hm[2] }); continue; }
    const mm = line.match(MOK_RE);
    if (mm) { cur.blocks.push({ level: 'mok', no: mm[1], text: mm[2] }); continue;
    }
    // 계속 줄 — 앞 블록에 병합 (경계문자면 공백, 중간절단이면 무공백)
    const last = cur.blocks[cur.blocks.length - 1];
    if (!last) continue;
    const sep = WORD_BOUNDARY_END_RE.test(last.text) ? ' ' : '';
    last.text += sep + line;
  }
  return articles;
}

/** 텍스트 정제: 개정 태그·깨진 태그 잔편 제거, 공백 정규화 */
function cleanText(t) {
  return String(t || '')
    .replace(REVISION_RE, '')
    .replace(/<[^>]{0,40}$/, '')
    .replace(/^[^<]{0,40}>/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 열거 주제 추출: 마커 앞 절에서 인용 용어("X") 우선 → 'quote',
 * 없으면 마지막 문장(`.`/`다만,` 이후)의 조사-절 꼬리 → 'tail',
 * 둘 다 실패 시 조문 제목 → 'title'. 'quote'만 주제형 발문에 쓴다.
 */
function enumTopic(blockText, articleTitle) {
  const head = cleanText(blockText.slice(0, blockText.search(ENUM_MARK_RE)));
  const qm = head.match(/["'“]([^"'”]{2,30})["'”]/);
  if (qm) return { topic: qm[1], src: 'quote' };
  const seg = head.split(/[.。]|다만,|그러나,/).pop() || '';
  const tail = seg.trim()
    .replace(/^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|\d+\.|[가-하]\.)\s*/, '')
    .replace(/\s*(을|를|은|는|이|가|에|으로)\s*$/, '')
    .trim();
  if (tail.length >= 3 && tail.length <= 40) return { topic: tail, src: 'tail' };
  return { topic: articleTitle, src: 'title' };
}

const CAT_RE = /^([가-하])\.\s*(.+)$/;      // 별표 카테고리: 가. 영유아용 제품류
const NP_RE = /^(\d+)\)\s*(.+)$/;           // 카테고리 멤버: 1) 영유아용 샴푸

/**
 * 별표 계층 목록 — '가. 카테고리명' 아래 'N) 멤버' 구조
 * (주의사항 별표 유형 분류 등). 조문 구조가 없는 표 문서 전용.
 * 반환: [{topic, members[]}]
 */
function extractCategoryLists(lines) {
  const lists = [];
  let cur = null;
  const catRe = /^([가-하])\.\s*(.+)$/;
  const npRe = /^\d+\)\s*(.+)$/;
  for (const raw of lines) {
    const t = raw.trim();
    const cm = t.match(catRe);
    // 카테고리명은 명사구여야 함 — 문장형(동사 종결·마침표)은 산문 오인
    const catName = cm && cm[2].trim();
    if (cm && catName.length <= 40 && !/조|항|호|기준|고시/.test(catName.slice(0, 4))
      && !/[.。…]/.test(catName) && !/(다|음|함|임|까|요|고|며|서|라|니)$/.test(catName)
      && !/^(또한|다만|그러나|그리고|또는|즉|이)/.test(catName)) {
      cur = { topic: cm[2].trim(), members: [] };
      lists.push(cur);
      continue;
    }
    const nm = t.match(npRe);
    if (nm && cur) {
      cur.members.push(nm[1].trim());
      continue;
    }
    // 멤버 계속 줄 — 미완결 텍스트(미닫힘 괄호·인용, 접속어미 종료)만 병합.
    // 완결된 명사구 뒤의 행은 별도 셀(주의사항 문구 등)이므로 붙이지 않는다.
    if (cur && cur.members.length && t && !/^#|\[|▣|■|※/.test(t) && t.length <= 40
      && !/^\d+$/.test(t)) {
      const last = cur.members[cur.members.length - 1];
      const open = (last.match(/[("「'“]/g) || []).length
        > (last.match(/[)"」'”]/g) || []).length;
      const dangling = /[,·\-와과및]$|는$|의$|에$|을$|를$/.test(last);
      if (open || dangling) cur.members[cur.members.length - 1] += ' ' + t;
    }
  }
  // 공백 소실 문서의 목록은 주제·멤버가 붙어 있어 진술로 부적합 — 제외
  const spaceless = s => (s.match(/[가-힣]/g) || []).length > 12 && !/ /.test(s);
  return lists.filter(l => l.members.length >= 3 && !spaceless(l.topic))
    .map(l => ({ ...l, members: l.members.filter(m => !spaceless(m)) }))
    .filter(l => l.members.length >= 3);
}

/**
 * 번호 없는 원료 표는 셀 절단·행 뒤섞임이 심해 이름 조각이 다수 포함된다
 * (트하이드록, 하이드로클로라 류). 신뢰 불가 — 추출하지 않는다.
 *
 * ※ pdfplumber 재변환(ref_md v2) 이후 원료 표는 정상 MD 표로 복원됐으므로
 *   extractMdTableLists()가 `| 원료명 | CAS | … |` 행에서 멤버를 추출한다.
 */

/** MD 표 멤버 열 후보 헤더 (이 순서로 우선 매칭) */
const MD_MEMBER_COL_RE = /^(원 ?료 ?명|성분명?|품목명?|항목|명칭|종류|제품명|색소명|화학물질명|구분|대상)$/;
/** 헤더 매칭 실패 시 대체: 1열 값이 이름형(한글 비율·길이)인 표 */
const NAME_LIKE_RE = /[가-힣]/;

function isNameCell(t) {
  return !!t && /[가-힣]/.test(t) && t.length >= 3 && t.length <= 60
    && !/[<>※]/.test(t) && !/^\d/.test(t)
    && !/^[을를은는이가의에로와과도만및]/.test(t)
    && !/CAS|등록번호|연번|비고|기준|별표|번$/.test(t);
}

/**
 * 정상 MD 표(`| a | b |`)에서 멤버 이름 열 추출.
 * - 헤더 행(구분선 `| --- |` 앞)에서 이름형 열을 찾고, 없으면 1열 사용
 * - 페이지 경계 반복 헤더로 끊긴 연속 표는 같은 열 구조면 병합
 * - rowspan 계승 빈 셀·품질 미달 값은 제외
 * 반환: [{header, members[]}]
 */
function extractMdTableLists(lines) {
  const tables = [];
  let cur = null; // {header: string[], rows: string[][]}
  for (const raw of lines) {
    const t = raw.trim();
    if (/^\|.*\|$/.test(t)) {
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^-{2,}$/.test(c) || !c)) continue; // 구분선
      if (!cur) cur = { header: cells, rows: [] };
      else if (cells.join('|') === cur.header.join('|')) continue; // 반복 헤더
      else cur.rows.push(cells);
      continue;
    }
    if (cur) { tables.push(cur); cur = null; }
  }
  if (cur) tables.push(cur);

  // 연속된 동형 표(페이지 경계 분할) 병합
  const merged = [];
  for (const tb of tables) {
    const prev = merged[merged.length - 1];
    if (prev && prev.header.join('|') === tb.header.join('|')) {
      prev.rows.push(...tb.rows);
    } else merged.push(tb);
  }

  const lists = [];
  for (const tb of merged) {
    // 헤더 매칭 우선, 실패 시 이름형 값이 가장 많은 열 선택 (연번 열 회피)
    let col = tb.header.findIndex(h => MD_MEMBER_COL_RE.test(h.replace(/\s+/g, '')));
    let bodyRows = tb.rows;
    if (col < 0) {
      const width = Math.max(...tb.rows.map(r => r.length), tb.header.length, 0);
      let best = -1, bestScore = 7;
      for (let c = 0; c < width; c++) {
        const score = tb.rows.filter(r => isNameCell((r[c] || '').trim())).length;
        if (score > bestScore) { best = c; bestScore = score; }
      }
      col = best;
      // 헤더로 잡힌 첫 행이 실제 데이터면 행에 포함 (헤더 없는 표)
      if (col >= 0 && isNameCell((tb.header[col] || '').trim())) {
        bodyRows = [tb.header, ...tb.rows];
      }
    }
    if (col < 0) continue;
    const members = [];
    for (const r of bodyRows) {
      // 괄호 헤딩 접두 제거 — "(피험자 선정) 피험자는 …" → "피험자는 …"
      const cell = (r[col] || '').trim()
        .replace(/^\([가-힣 ]{2,15}\)\s+(?=[가-힣])/, '');
      if (!isNameCell(cell)) continue;
      // 괄호·따옴표 불균형 = 셀 절단 잔재
      const open = (cell.match(/[(\["'“「]/g) || []).length;
      const close = (cell.match(/[)\]"'”」]/g) || []).length;
      if (open !== close) continue;
      if (!members.includes(cell)) members.push(cell);
    }
    if (members.length >= 8) {
      lists.push({ header: (tb.header[col] || '').replace(/\s+/g, ''), members });
    }
  }
  return lists;
}

/** 표 원자의 주제 라벨 (dirName → 발문용 주제). 없으면 문서명 인용 발문 사용 */
const TABLE_TOPICS = {
  '주의사항_별표2_알레르기유발성분25종': '착향제 구성 성분 중 알레르기 유발 성분',
  '색소종류및기준_전체': '식품의약품안전처장이 고시한 색소',
  '안전기준_별표1_사용불가원료': '화장품에 사용할 수 없는 원료',
  '안전기준_별표2_사용제한원료': '화장품에 사용이 제한되는 원료',
  '주의사항_별표1_유형별주의사항표시문구': '',
};

/**
 * 연번형 표(숫자 단독줄 → 첫 셀이 이름)에서 멤버 이름 열 추출.
 * 연번이 순차적이고 이름 셀 품질 조건을 만족하는 표만 채택한다.
 * 번호가 1로 재시작하면 새 표로 분할. 반환: 이름 배열의 배열.
 */
function extractTableLists(lines) {
  const lists = [];
  let cur = null, expected = 1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/^\d{1,4}$/.test(t)) continue;
    const n = +t;
    if (n === 1 && expected > 2) {           // 새 표 시작
      if (cur && cur.length >= 8) lists.push(cur);
      cur = []; expected = 1;
    }
    if (n !== expected) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const cell = (lines[j] || '').trim();
    const ok = /[가-힣]/.test(cell) && cell.length >= 3 && cell.length <= 45
      && !/[<>]/.test(cell)
      && !/CAS|등록번호|연번|성분명|원료명|화학물질명|별표|사용할수|기준$|호$/.test(cell);
    // 형식이 어긋난 행은 건너뛰되 연번 추적은 계속 — 한 행 오류로 표 전체가 죽지 않게
    expected++;
    if (!ok) continue;
    if (!cur) cur = [];
    cur.push(cell);
  }
  if (cur && cur.length >= 8) lists.push(cur);
  return lists;
}

/* ---------- 원료 큐레이션 DB (content/참조자료/원료/*.md) ---------- */
// PDF 변환본(ref_md)의 원료 표보다 품질이 높은 수작업 정제 데이터.
// 파일별 섹션 표의 첫 열(원료명/성분명)을 멤버십 목록으로 추출한다.
//   - 섹션 목록: 카테고리 문항 ("별표2의 보존제 성분에 해당하는 것")
//   - 전체 목록: 별표1·별표2 문항 ("사용할 수 없는 원료에 해당하는 것")
// 섹션을 전체 목록보다 먼저 배출해 60% 중복 스킵에서 부분집합이 먼저 채택되게 한다.
const INGREDIENT_FILES = [
  {
    file: 'banned_ingredients.md',
    docShort: '원료DB 별표1 사용불가원료',
    wholeTopic: '화장품에 사용할 수 없는 원료(별표1)',
    wholeRe: /^##\s*Chapter\s*01/,              // 전체 목록 표
    sectionRe: /^###\s*\d+\.\s*(.+)$/,          // 카테고리별 주요 성분
    secPrefix: '사용불가 원료(별표1)의 ',
    cap: 24,
  },
  {
    file: 'restricted_ingredients.md',
    docShort: '원료DB 별표2 사용제한원료',
    wholeTopic: '사용상의 제한이 필요한 원료(별표2)',
    sectionRe: /^##\s*\(\d+\)\s*(.+)$/,         // (1) 보존제 성분 …
    secPrefix: '사용제한 원료(별표2)의 ',
    cap: 18,
  },
  {
    file: 'approved_ingredients.md',
    docShort: '원료DB 일반 원료',
    sectionRe: /^#{3,4}\s*(.+)$/,
    // 별표1·2 요약 표는 전용 파일과 중복 — 도메인 섹션만 채택
    sectionAllow: /^(수성 원료|유성 원료|점증제|계면활성제|보존제|자외선 차단제|기능성 성분|마이크로바이옴|산화방지제|알레르기 유발 성분|고시 기능성)/,
    cap: 14,
  },
];

/** 섹션 제목 정제: 번호·꼬리 괄호 주석 제거 ("1. 중금속 …(반드시 암기)" → "중금속 …") */
function cleanSectionTitle(t) {
  return String(t || '')
    .replace(/^\(?\d+\)?[.)]?\s*/, '')
    .replace(/\s*[(（][^)）]*[)）]\s*$/, '')
    .trim();
}

/** 표 첫 열의 원료명 정제: 볼드·각주 마커 제거 */
function cleanIngName(cell) {
  return String(cell || '')
    .replace(/\*\*/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 원료 큐레이션 파일에서 enum 원자 추출.
 * 섹션 표 → 카테고리 목록, wholeRe 표(or 섹션 합집합) → 전체 목록.
 * 반환 원자에 curated:true — 빌더가 우선 처리해 ref_md 중복본을 자동 탈락시킨다.
 */
function extractIngredientAtoms(ingDir) {
  const atoms = [];
  for (const spec of INGREDIENT_FILES) {
    const fp = path.join(ingDir, spec.file);
    if (!fs.existsSync(fp)) continue;
    const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
    const sections = [];   // {title, members[]}
    const whole = [];      // 전체 목록 표 멤버
    let cur = null;        // 현재 섹션 또는 'whole'
    for (const raw of lines) {
      const t = raw.trim();
      if (spec.wholeRe && spec.wholeRe.test(t)) { cur = 'whole'; continue; }
      const sm = spec.sectionRe && t.match(spec.sectionRe);
      if (sm) {
        const title = cleanSectionTitle(sm[1]);
        cur = (!spec.sectionAllow || spec.sectionAllow.test(title)) && title
          ? { title, members: [] } : null;
        if (cur) sections.push(cur);
        continue;
      }
      if (/^#{1,4}\s/.test(t)) { cur = null; continue; }   // 다른 헤딩 → 섹션 종료
      if (!/^\|.*\|$/.test(t)) continue;
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^-{2,}$/.test(c) || !c)) continue;   // 구분선
      const name = cleanIngName(cells[0]);
      if (!name || /^(원료명|성분명|원료|필드|구분|이름)$/.test(name)) continue;
      if (cur === 'whole') whole.push(name);
      else if (cur) cur.members.push(name);
    }
    for (const [i, s] of sections.entries()) {
      const members = [...new Set(s.members)];
      if (members.length < 4) continue;
      atoms.push({
        kind: 'enum', topic: `${spec.secPrefix || ''}${s.title}`, topicSrc: 'quote',
        members, listId: `원료|${spec.file}|sec${i}`,
        text: '', docShort: spec.docShort, article: s.title,
        curated: true, curCap: spec.cap,
      });
    }
    const wholeSet = [...new Set(whole.length ? whole : sections.flatMap(s => s.members))];
    if (spec.wholeTopic && wholeSet.length >= 8) {
      atoms.push({
        kind: 'enum', topic: spec.wholeTopic, topicSrc: 'quote',
        members: wholeSet, listId: `원료|${spec.file}|all`,
        text: '', docShort: spec.docShort, article: '',
        curated: true, curCap: spec.cap,
      });
    }
  }
  return atoms;
}

/**
 * 한 문서에서 def/enum 원자 추출.
 * enum: ENUM_MARK_RE를 포함하는 블록의 "직후 동일 레벨 항목들"을 멤버로 수집.
 *   - '각 호' 마커 → 뒤따르는 ho 항목들, '각 목' 마커 → 뒤따르는 mok 항목들.
 *   - 마커가 ho 항목 안에 있으면 그 항목의 자식 mok 항목들이 멤버.
 */
function extractDocAtoms(dirName, lines) {
  const docShort = docShortName(dirName);
  const atoms = [];
  const articles = parseArticles(lines);

  // 연번형 표 → 멤버십 목록 (알레르기 유발성분, 색소 등)
  extractTableLists(lines).forEach((names, ti) => {
    atoms.push({
      kind: 'enum',
      topic: TABLE_TOPICS[dirName] || '',
      topicSrc: TABLE_TOPICS[dirName] ? 'quote' : 'table',
      members: names,
      listId: `${dirName}|table|${ti}`,
      text: '', docShort, article: '',
    });
  });

  // 정상 MD 표 → 멤버십 목록 (ref_md v2: 원료·성분 표가 행 구조로 복원됨)
  extractMdTableLists(lines).forEach((l, ti) => {
    // 헤더가 데이터형 값(성분명 등)이면 주제로 쓸 수 없음 — 문서명 발문으로.
    // '명칭'·'구분' 같은 범용 헤더 단어도 주제로서 무의미 — 마찬가지로 강등
    const GENERIC_TOPIC_RE = /^(명칭|구분|항목|성분명?|원료명?|대상|종류|내용|제품명)$/;
    const headerOk = l.header && !isNameCell(l.header)
      && MD_MEMBER_COL_RE.test(l.header.replace(/\s+/g, ''))
      && !GENERIC_TOPIC_RE.test(l.header.replace(/\s+/g, ''));
    atoms.push({
      kind: 'enum',
      topic: TABLE_TOPICS[dirName] || (headerOk ? l.header : ''),
      topicSrc: TABLE_TOPICS[dirName] || headerOk ? 'quote' : 'table',
      members: l.members,
      listId: `${dirName}|mdtable|${ti}`,
      text: '', docShort, article: '',
    });
  });

  // 별표 계층 목록 (가. 카테고리 + N) 멤버) — 조문 없는 표 문서 전용.
  // KFCC 시험법 등의 cat 목록은 절차 조각이 멤버로 섞여 문항 소재로 부적합 —
  // 제품유형 분류가 실제 의미를 갖는 주의사항 계열 문서로 한정한다.
  if (!articles.length && /주의사항|알레르기/.test(dirName)) {
    // 주제가 쓸 수 없는 형태(괄호·수식 조각, 한글 없음)면 제네릭 발문으로 강등
    const topicOk = t => /[가-힣]/.test(t) && !/^[(\d]/.test(t) && !/[×÷=±]/.test(t);
    extractCategoryLists(lines).forEach((l, ci) => {
      atoms.push({
        kind: 'enum', topic: topicOk(l.topic) ? l.topic : '',
        topicSrc: topicOk(l.topic) ? 'quote' : 'table',
        members: l.members, listId: `${dirName}|cat|${ci}`,
        text: '', docShort, article: '',
      });
    });
  }

  // 번호 없는 원료 표(사용불가·사용제한)는 셀 절단 손상으로 추출 불가 — 제외

  for (const a of articles) {
    const defs = [];
    for (let i = 0; i < a.blocks.length; i++) {
      const b = a.blocks[i];
      b.text = cleanText(b.text);
      if (!b.text || /^삭제/.test(b.text)) continue;

      // 정의조항 — "X"이란/은/는 … 말한다
      // 열거 도입형 정의("…이란 다음 각 목의 …")는 자립 진술이 아니므로 제외
      const dm = !ENUM_MARK_RE.test(b.text) && b.text.match(DEF_RE);
      if (dm && dm[3].length >= 10 && !/제\d+조|한다\)|의\d+호/.test(dm[1])) {
        const atom = {
          kind: 'def', term: dm[1].trim(), defBody: dm[3].trim(),
          endPhrase: `${dm[4] ? dm[4] + ' ' : ''}${dm[5]}`,
          text: b.text, docShort, article: a.art,
          ho: b.level === 'ho' ? `제${b.no}호` : '',
        };
        defs.push(atom);
        atoms.push(atom);
      }

      // 열거 목록 — 마커가 들어있는 블록
      if (ENUM_MARK_RE.test(b.text)) {
        const mm = b.text.match(/다음 각 (호|목)/);
        const wantLevel = mm ? (mm[1] === '호' ? 'ho' : 'mok') : null;
        if (!wantLevel) continue;
        // 마커 이후 동일 레벨 항목 = 멤버. 하위 레벨(호 안의 목)은 건너뛰고,
        // para(① 절)·상위 레벨이 나오면 목록 종료.
        const members = [];
        for (let j = i + 1; j < a.blocks.length; j++) {
          const nb = a.blocks[j];
          let nt = cleanText(nb.text);
          if (nb.level === 'para' || (wantLevel === 'mok' && nb.level === 'ho')) break;
          if (nb.level !== wantLevel) continue;
          // ② 절 시작·페이지 구분선이 병합된 경우 그 앞까지만 멤버로 사용
          nt = nt.split(/[②-⑩]|-{3,}|\*{3,}/)[0].trim();
          // "(피험자 선정) …" 같은 괄호 헤딩 접두 제거 — (1R,2S)- 같은
          // 입체화학명은 접두가 한글만이 아니므로 대상에서 제외된다
          nt = nt.replace(/^\([가-힣 ]{2,15}\)\s+(?=[가-힣])/, '');
          if (!/^삭제/.test(nt) && !ENUM_MARK_RE.test(nt)
            && nt.length >= 6 && nt.length <= 160
            && (nt.match(/[가-힣]/g) || []).length / nt.length >= 0.4) {
            members.push(nt);
          }
        }
        if (members.length >= 3) {
          const et = enumTopic(b.text, a.title);
          // 절차문·단위 잔재·괄호 불균형·문장형 토픽은 발문에 쓸 수 없음 → 문서명 발문
          if (et.src === 'tail'
            && (/[(\["'“「]/.test(et.topic) !== /[)\]"'”」]/.test(et.topic)
              || /(다|음|함|임|까|요)\.?$|[.。…]|㎍|㎖|mL|ppm|[×÷=<>±~]/.test(et.topic))) {
            et.topic = ''; et.src = 'table';
          }
          atoms.push({
            kind: 'enum', topic: et.topic, topicSrc: et.src, members,
            listId: `${dirName}|${a.art}|${i}`,
            text: b.text, docShort, article: a.art,
          });
        }
      }
    }
  }
  return atoms;
}

/**
 * ref_md 전체를 스캔해 과목별 원자 묶음 반환.
 * @returns {Object<number, {defs:Atom[], enums:Atom[]}>}
 */
function extractRefAtoms(refDir) {
  const bySubject = {};
  if (!fs.existsSync(refDir)) return bySubject;
  const dirs = fs.readdirSync(refDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  for (const dirName of dirs) {
    const subject = docSubject(dirName);
    if (!subject) continue;
    const md = fs.readdirSync(path.join(refDir, dirName)).find(f => f.endsWith('.md'));
    if (!md) continue;
    const text = fs.readFileSync(path.join(refDir, dirName, md), 'utf8');
    if (isSpaceless(text)) continue;   // 공백 소실 PDF 변환본 제외
    const atoms = extractDocAtoms(dirName, text.split(/\r?\n/));
    if (!atoms.length) continue;
    const bucket = bySubject[subject] || (bySubject[subject] = { defs: [], enums: [], docs: new Set() });
    for (const a of atoms) {
      if (a.kind === 'def') bucket.defs.push(a); else bucket.enums.push(a);
      bucket.docs.add(dirName);
    }
  }
  // 원료 큐레이션 DB (ref_md의 형제 디렉터리) — 과목2에 귀속.
  // curated 원자는 빌더에서 ref_md 목록보다 먼저 처리된다.
  const ingDir = path.join(refDir, '..', '원료');
  for (const a of extractIngredientAtoms(ingDir)) {
    const bucket = bySubject[2] || (bySubject[2] = { defs: [], enums: [], docs: new Set() });
    bucket.enums.push(a);
    bucket.docs.add(a.listId.split('|')[0]);
  }
  return bySubject;
}

module.exports = { extractRefAtoms, docShortName, docSubject };
