const fs = require('fs');
const path = require('path');

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
};

// 표 플레이스홀더(-, —)는 빈 값으로 처리
const pick = (cells, idx) => {
  if (idx === -1 || idx == null) return '';
  const v = cleanText(cells[idx]);
  return /^[-–—\s]*$/.test(v) ? '' : v;
};

// 원료 소스 표는 통일 스키마를 따른다:
// 원료명 | 영문명 | 카테고리 | 베이스 | 특성 및 설명 | 일반 함량 범위 | 최대 함량 | 증상 효과 | 시험 출제 빈도 | 고득점 TIP | 비고
// (레거시 헤더명·소문 변형은 findIndex 조건으로 관대하게 수용)
const colIdx = (headers, ...names) =>
  headers.findIndex(h => names.some(n => n === h || h.includes(n)));

function parseMarkdownTables(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const results = [];
  let currentSection = '';
  let inTable = false;
  let headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('### ')) {
      currentSection = line.substring(4).trim();
      continue;
    } else if (line.startsWith('## ')) {
      currentSection = line.substring(3).trim();
      continue;
    }

    if (line.startsWith('|')) {
      if (line.includes('---')) {
        continue;
      }

      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);

      if (!inTable) {
        headers = cells.map(h => cleanText(h));
        inTable = true;
      } else {
        results.push({
          section: currentSection,
          headers: headers,
          cells: cells
        });
      }
    } else {
      inTable = false;
    }
  }
  return results;
}

// 파일별 타입·기본값만 다르고 컬럼 해석은 동일
const SOURCES = [
  {
    file: 'approved_ingredients.md',
    type: 'approved',
    category: (cells, idx, item) => pick(cells, idx) || item.section,
    description: (cells, idx, item, noteIdx) => pick(cells, idx) || pick(cells, noteIdx),
    limit: '',
    tip: (cells, idx) => pick(cells, idx),
  },
  {
    file: 'restricted_ingredients.md',
    type: 'restricted',
    category: (cells, idx) => pick(cells, idx) || '사용 제한 원료',
    description: (cells, idx, item, noteIdx) => pick(cells, idx) || pick(cells, noteIdx) || '사용 제한 필요한 원료',
    limit: '',
    tip: (cells, idx, item, noteIdx) => pick(cells, idx) || pick(cells, noteIdx),
  },
  {
    file: 'banned_ingredients.md',
    type: 'banned',
    category: (cells, idx) => pick(cells, idx) || '사용 금지 원료',
    description: (cells, idx, item, noteIdx) => pick(cells, idx) || pick(cells, noteIdx) || '배합 금지 성분',
    limit: '사용 불가 (0%)',
    // 금지 원료는 '증상 효과' 컬럼에 불법 용도(미백 등)가 들어 있음
    tip: (cells, idx, item, noteIdx, symIdx) => pick(cells, idx) || pick(cells, symIdx) || '화장품 제조/조제에 사용이 금지되는 원료입니다.',
  },
];

module.exports = {
  name: 'ingredients',
  build(manifest, ctx) {
    const list = [];
    const INGREDIENTS_DIR = path.join(ctx.workspaceDir, ctx.contentRoot || 'content', '참조자료', '원료');

    SOURCES.forEach(src => {
      const filePath = path.join(INGREDIENTS_DIR, src.file);
      if (!fs.existsSync(filePath)) return;

      parseMarkdownTables(filePath).forEach(item => {
        const nameIdx = colIdx(item.headers, '원료명', '성분명');
        if (nameIdx === -1) return;

        const engIdx = colIdx(item.headers, '영문명');
        const catIdx = colIdx(item.headers, '카테고리');
        const descIdx = colIdx(item.headers, '특성 및 설명', '특성');
        const noteIdx = colIdx(item.headers, '비고', '예외 조건');
        const limitIdx = colIdx(item.headers, '최대 함량', '사용한도', '농도상한');
        const tipIdx = colIdx(item.headers, '고득점 TIP', 'TIP');
        const symIdx = colIdx(item.headers, '증상');

        const name = cleanText(item.cells[nameIdx]);
        if (!name || name === '원료명' || name === '성분명') return;

        const ingredientObj = {
          name,
          engName: pick(item.cells, engIdx),
          type: src.type,
          category: src.category(item.cells, catIdx, item),
          description: src.description(item.cells, descIdx, item, noteIdx),
          limit: pick(item.cells, limitIdx) || src.limit,
          tip: src.tip(item.cells, tipIdx, item, noteIdx, symIdx),
        };

        const existingIdx = list.findIndex(i => i.name === name);
        if (existingIdx !== -1) {
          // 뒤에 오는 포괄 목록(Chapter 01 등)이 고빈도 섹션의 구체 카테고리를 덮지 않도록 보존
          if (ingredientObj.category === '사용 금지 원료' && list[existingIdx].category !== '사용 금지 원료') {
            ingredientObj.category = list[existingIdx].category;
          }
          list[existingIdx] = ingredientObj;
        } else {
          list.push(ingredientObj);
        }
      });
    });

    return list;
  }
};
