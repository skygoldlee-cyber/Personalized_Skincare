const crypto = require('crypto');

const CONTENT_HASH_LEN = 8;
const ID_HASH_LEN = 6;

function shortHash(input, length = ID_HASH_LEN) {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, length);
}

function stableId(subjectKey, chapterKey, type, term) {
  // subjectKey + chapterKey + term (단원 간 용어 중복 대응, definition 제외로 오탈자 변경 시 진행 보존)
  const raw = `${subjectKey}|${chapterKey}|${term}`;
  return `${subjectKey}_${type}_${shortHash(raw)}`;
}

module.exports = {
  shortHash,
  stableId,
  CONTENT_HASH_LEN,
  ID_HASH_LEN
};
