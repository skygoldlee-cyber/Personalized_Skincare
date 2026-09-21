const fs = require('fs');
const path = require('path');

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
};

// 표 플레이스홀더(-, —)는 빈 값으로 처리해 실제 내용이 있는 컬럼만 매핑
const pick = (cells, idx) => {
  if (idx === -1 || idx == null) return '';
  const v = cleanText(cells[idx]);
  return /^[-–—\s]*$/.test(v) ? '' : v;
};

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

module.exports = {
  name: 'ingredients',
  build(manifest, ctx) {
    const list = [];
    const INGREDIENTS_DIR = path.join(ctx.workspaceDir, ctx.contentRoot || 'content', '참조자료', '원료');

    // 1. Approved ingredients
    const approvedPath = path.join(INGREDIENTS_DIR, 'approved_ingredients.md');
    if (fs.existsSync(approvedPath)) {
      const parsed = parseMarkdownTables(approvedPath);
      parsed.forEach(item => {
        const nameIdx = item.headers.findIndex(h => h.includes('원료명') || h.includes('성분명'));
        const engIdx = item.headers.findIndex(h => h.includes('영문명'));
        const catIdx = item.headers.findIndex(h => h.includes('카테고리'));
        const descIdx = item.headers.findIndex(h => h.includes('특성'));
        const noteIdx = item.headers.findIndex(h => h === '비고' || h.includes('예외 조건'));
        const limitIdx = item.headers.findIndex(h => h.includes('최대 함량') || h.includes('사용한도'));
        const tipIdx = item.headers.findIndex(h => h.includes('TIP') || h.includes('비고'));
        
        if (nameIdx !== -1) {
          const name = cleanText(item.cells[nameIdx]);
          if (name && name !== '원료명' && name !== '성분명') {
            list.push({
              name: name,
              engName: engIdx !== -1 ? cleanText(item.cells[engIdx]) : '',
              type: 'approved',
              category: catIdx !== -1 ? cleanText(item.cells[catIdx]) : item.section,
              description: pick(item.cells, descIdx) || pick(item.cells, noteIdx),
              limit: pick(item.cells, limitIdx),
              tip: pick(item.cells, tipIdx)
            });
          }
        }
      });
    }

    // 2. Restricted ingredients
    const restrictedPath = path.join(INGREDIENTS_DIR, 'restricted_ingredients.md');
    if (fs.existsSync(restrictedPath)) {
      const parsed = parseMarkdownTables(restrictedPath);
      parsed.forEach(item => {
        const nameIdx = item.headers.findIndex(h => h.includes('원료명') || h.includes('성분명'));
        const engIdx = item.headers.findIndex(h => h.includes('영문명'));
        const catIdx = item.headers.findIndex(h => h.includes('카테고리'));
        const limitIdx = item.headers.findIndex(h => h.includes('사용한도') || h.includes('농도상한'));
        const tipIdx = item.headers.findIndex(h => h.includes('TIP'));
        // 설명문은 '비고' 컬럼에 있음 (특성/설명 헤더가 있으면 우선)
        const descIdx = item.headers.findIndex(h => h.includes('특성') || h.includes('설명'));
        const noteIdx = item.headers.findIndex(h => h === '비고' || h === '비 고');
        
        if (nameIdx !== -1) {
          const name = cleanText(item.cells[nameIdx]);
          if (name && name !== '원료명' && name !== '성분명') {
            const existingIdx = list.findIndex(i => i.name === name);
            const ingredientObj = {
              name: name,
              engName: engIdx !== -1 ? cleanText(item.cells[engIdx]) : '',
              type: 'restricted',
              category: catIdx !== -1 ? cleanText(item.cells[catIdx]) : '사용 제한 원료',
              description: pick(item.cells, descIdx) || pick(item.cells, noteIdx) || '사용 제한 필요한 원료',
              limit: pick(item.cells, limitIdx),
              tip: pick(item.cells, tipIdx) || pick(item.cells, noteIdx)
            };
            
            if (existingIdx !== -1) {
              list[existingIdx] = ingredientObj;
            } else {
              list.push(ingredientObj);
            }
          }
        }
      });
    }

    // 3. Banned ingredients
    const bannedPath = path.join(INGREDIENTS_DIR, 'banned_ingredients.md');
    if (fs.existsSync(bannedPath)) {
      const parsed = parseMarkdownTables(bannedPath);
      parsed.forEach(item => {
        const nameIdx = item.headers.findIndex(h => h.includes('원료명') || h.includes('성분명'));
        const engIdx = item.headers.findIndex(h => h.includes('영문명'));
        // 4번째 컬럼(비고/설명/예외 조건)에 분류·사유가, '증상 효과'는 대부분 '-'
        const noteIdx = item.headers.findIndex(h => h === '비고' || h.includes('설명') || h.includes('예외 조건'));
        const symIdx = item.headers.findIndex(h => h.includes('증상'));
        
        if (nameIdx !== -1) {
          const name = cleanText(item.cells[nameIdx]);
          if (name && name !== '원료명' && name !== '성분명') {
            const existingIdx = list.findIndex(i => i.name === name);
            const ingredientObj = {
              name: name,
              engName: engIdx !== -1 ? cleanText(item.cells[engIdx]) : '',
              type: 'banned',
              category: '사용 금지 원료',
              description: pick(item.cells, noteIdx) || '배합 금지 성분',
              limit: '사용 불가 (0%)',
              tip: pick(item.cells, symIdx) || '화장품 제조/조제에 사용이 금지되는 원료입니다.'
            };
            
            if (existingIdx !== -1) {
              list[existingIdx] = ingredientObj;
            } else {
              list.push(ingredientObj);
            }
          }
        }
      });
    }
    
    return list;
  }
};
