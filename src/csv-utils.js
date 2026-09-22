// Formula OS — CSV 유틸리티 (가져오기/보내기/양식)
// 외부 라이브러리 없이 RFC4180 따옴표 필드·구분자 자동 감지·한글 인코딩 폴백을 처리한다.
// Excel이 생성하는 CSV는 대부분 CP949(EUC-KR)이므로 UTF-8 strict 디코딩 실패 시
// EUC-KR로 재시도한다. 보내기는 UTF-8 BOM을 붙여 Excel에서 한글이 깨지지 않게 한다.

/* =======================================================
   디코딩 — BOM → UTF-8 strict → EUC-KR 폴백
   ======================================================= */

/**
 * ArrayBuffer → 텍스트. UTF-8 BOM이면 UTF-8, 아니면 UTF-8 strict 시도 후 EUC-KR 폴백.
 * @param {ArrayBuffer} buf
 */
export function decodeCsvBuffer(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    return new TextDecoder('euc-kr').decode(bytes);
  }
}

/** File → 텍스트 (인코딩 자동 판별) */
export function readCsvFile(file) {
  return file.arrayBuffer().then(decodeCsvBuffer);
}

/* =======================================================
   파싱 — 따옴표 필드·"" 이스케이프·CRLF·구분자 자동 감지
   ======================================================= */

function detectDelimiter(firstLine) {
  for (const d of ['\t', ';', ',']) {
    if (firstLine.includes(d)) return d;
  }
  return ',';
}

/**
 * CSV 텍스트 → 행 배열 (각 행은 문자열 배열).
 * 빈 행은 제거. 따옴표 필드 안의 구분자·개행을 올바르게 처리한다.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const firstNl = text.indexOf('\n');
  const firstLine = (firstNl >= 0 ? text.slice(0, firstNl) : text);
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\r') {
      // skip — \n에서 행 종결
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

/**
 * 행 배열 → 객체 배열. 첫 행을 헤더로 사용하고 colMap(정규화 헤더→필드명)으로 매핑한다.
 * 헤더 정규화: trim + 소문자 + 공백 제거 — '피부 타입'과 '피부타입' 모두 매칭.
 * @param {string[][]} rows
 * @param {Object<string,string>} colMap - 정규화된 헤더 → 필드명
 * @returns {object[]}
 */
export function csvToObjects(rows, colMap) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => (colMap[h.trim().toLowerCase().replace(/\s+/g, '')] || null));
  if (!headers.some(Boolean)) return [];
  return rows.slice(1).map(r => {
    const obj = {};
    r.forEach((cell, i) => {
      if (i < headers.length && headers[i]) obj[headers[i]] = cell.trim();
    });
    return obj;
  });
}

/* =======================================================
   직렬화·다운로드
   ======================================================= */

function escapeCsvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 객체 배열 → CSV 텍스트 (UTF-8 BOM 포함 — Excel 호환).
 * @param {string[]} headers - 헤더 행 라벨
 * @param {object[]} rows
 * @param {(row:object)=>any[]} toRow - 객체 → 셀 배열 변환
 */
export function toCsv(headers, rows, toRow) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const r of rows) lines.push(toRow(r).map(escapeCsvCell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM
}

/** CSV 텍스트를 파일로 다운로드 (formula.js downloadJson과 동일한 data URI 패턴) */
export function downloadCsv(csv, filename) {
  const a = document.createElement('a');
  a.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
}
