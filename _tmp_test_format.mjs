import { formatSectionContentForReader } from './src/reader-format.js';

const rawContent = `> 출처: \`../참조자료/과목1/1.cosmetic-law.md\`

> 세 개의 화장품법 정리 문서를 하나로 병합한 자료입니다.

> **🗺️ 마인드맵 노드 상세 매핑**

| 대분류 | 중분류 |
|---|---|
| 법률 (L51) | — |
| 법률 (L51) | 화장품법 (L1) |
| 대통령령 (L251) | 시행령 (L51) |`;

const result = formatSectionContentForReader(rawContent);
console.log(result);
