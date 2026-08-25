const fs = require('fs');
const path = require('path');

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
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
    const INGREDIENTS_DIR = path.join(ctx.workspaceDir, 'content', 'ingredients');

    // 1. Approved ingredients
    const approvedPath = path.join(INGREDIENTS_DIR, 'approved_ingredients.md');
    if (fs.existsSync(approvedPath)) {
      const parsed = parseMarkdownTables(approvedPath);
      parsed.forEach(item => {
        const nameIdx = item.headers.findIndex(h => h.includes('원료명') || h.includes('성분명'));
        const engIdx = item.headers.findIndex(h => h.includes('영문명'));
        const catIdx = item.headers.findIndex(h => h.includes('카테고리'));
        const descIdx = item.headers.findIndex(h => h.includes('특성'));
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
              description: descIdx !== -1 ? cleanText(item.cells[descIdx]) : '',
              limit: limitIdx !== -1 ? cleanText(item.cells[limitIdx]) : '',
              tip: tipIdx !== -1 ? cleanText(item.cells[tipIdx]) : ''
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
        const tipIdx = item.headers.findIndex(h => h.includes('TIP') || h.includes('비고'));
        const descIdx = item.headers.findIndex(h => h.includes('특성') || h.includes('설명'));
        
        if (nameIdx !== -1) {
          const name = cleanText(item.cells[nameIdx]);
          if (name && name !== '원료명' && name !== '성분명') {
            const existingIdx = list.findIndex(i => i.name === name);
            const ingredientObj = {
              name: name,
              engName: engIdx !== -1 ? cleanText(item.cells[engIdx]) : '',
              type: 'restricted',
              category: catIdx !== -1 ? cleanText(item.cells[catIdx]) : '사용 제한 원료',
              description: descIdx !== -1 ? cleanText(item.cells[descIdx]) : '사용 제한 필요한 원료',
              limit: limitIdx !== -1 ? cleanText(item.cells[limitIdx]) : '',
              tip: tipIdx !== -1 ? cleanText(item.cells[tipIdx]) : ''
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
        const descIdx = item.headers.findIndex(h => h.includes('증상 효과') || h.includes('설명') || h.includes('특성'));
        const tipIdx = item.headers.findIndex(h => h.includes('비고') || h.includes('예외 조건'));
        
        if (nameIdx !== -1) {
          const name = cleanText(item.cells[nameIdx]);
          if (name && name !== '원료명' && name !== '성분명') {
            const existingIdx = list.findIndex(i => i.name === name);
            const ingredientObj = {
              name: name,
              engName: engIdx !== -1 ? cleanText(item.cells[engIdx]) : '',
              type: 'banned',
              category: '사용 금지 원료',
              description: descIdx !== -1 ? cleanText(item.cells[descIdx]) : '배합 금지 성분',
              limit: '사용 불가 (0%)',
              tip: tipIdx !== -1 ? cleanText(item.cells[tipIdx]) : '화장품 제조/조제에 사용이 금지되는 원료입니다.'
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
