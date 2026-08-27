const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { loadAndValidateManifest } = require('./manifest-loader');
const { validateSubjectData, validateExamData, validateIngredientsData } = require('./schema');
const { checkStatsAnomaly, printMarkerWarnings } = require('./report');
const idFactory = require('./id-factory');

const WORKSPACE_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const SUBJECTS_OUT_DIR = path.join(DATA_DIR, 'subjects');
const EXAMS_OUT_DIR = path.join(DATA_DIR, 'exams');

// Ensure directories exist
fs.mkdirSync(SUBJECTS_OUT_DIR, { recursive: true });
fs.mkdirSync(EXAMS_OUT_DIR, { recursive: true });

const ctx = {
  workspaceDir: WORKSPACE_DIR,
  idFactory: idFactory,
  logger: console
};

function getContentHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 8);
}

function clearOldBundles(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.startsWith(prefix) && file.endsWith('.js')) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch (e) {
        console.warn(`Warning: failed to delete old file ${file}:`, e.message);
      }
    }
  });
}

/**
 * #5 (--only): 부분 재빌드 시 나머지 과목/시험/원료 항목을 보존하기 위해
 * 이전 레지스트리(data/registry.js)를 파싱해 돌려준다. 없으면 null.
 * registry.js는 `var DATA_REGISTRY = { ...JSON... };` 형태(JSON.stringify 출력)이므로
 * 첫 '{' ~ 마지막 '}' 구간을 JSON.parse 한다.
 */
function loadPriorRegistry() {
  const p = path.join(DATA_DIR, 'registry.js');
  if (!fs.existsSync(p)) return null;
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    // 'DATA_REGISTRY =' 대입식 이후의 첫 '{' 부터, 문자열/이스케이프를 고려한
    // 중괄호 매칭으로 "객체 리터럴 구간만" 정확히 잘라낸다.
    //  - 선두 JSDoc `@type {import('...').DataRegistry}` 의 중괄호,
    //  - 말미 `if (typeof window ...) { window.DATA_REGISTRY = ... }` 블록의 중괄호를
    //    모두 오인하지 않는다. (기존 indexOf/lastIndexOf 방식의 파싱 실패 버그 수정)
    const assign = txt.indexOf('DATA_REGISTRY =');
    const from = assign === -1 ? 0 : assign;
    const start = txt.indexOf('{', from);
    if (start === -1) return null;

    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < txt.length; i++) {
      const c = txt[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (c === '\\') { esc = true; }
        else if (c === '"') { inStr = false; }
        continue;
      }
      if (c === '"') { inStr = true; }
      else if (c === '{') { depth++; }
      else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    return JSON.parse(txt.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

/** 이전 .last-stats.json 로드 (부분 빌드 시 통계 병합용). 없으면 빈 구조. */
function loadPriorStats(statsPath) {
  if (!fs.existsSync(statsPath)) return { subjects: {}, exams: {} };
  try {
    const s = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    return { subjects: s.subjects || {}, exams: s.exams || {} };
  } catch (e) {
    return { subjects: {}, exams: {} };
  }
}

/** `--only law,safety` 형태의 인자를 파싱. 없으면 null(=전체 빌드). */
function parseOnlyKeys(argv) {
  const idx = argv.indexOf('--only');
  if (idx === -1) return null;
  const raw = argv[idx + 1];
  if (!raw || raw.startsWith('--')) {
    console.error('--only 옵션에는 과목 키가 필요합니다. 예: --only law 또는 --only law,safety');
    process.exit(1);
  }
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  return keys.length ? keys : null;
}

function main() {
  console.log('--- Cosmetic Pass Master: Modular Build System ---');

  const onlyKeys = parseOnlyKeys(process.argv);
  const isPartial = Array.isArray(onlyKeys);

  // 1. Load and validate manifest
  const manifestPath = path.join(WORKSPACE_DIR, 'content', 'manifest.json');
  let manifest;
  try {
    manifest = loadAndValidateManifest(manifestPath, WORKSPACE_DIR);
    console.log('Manifest loaded and validated successfully.');
  } catch (e) {
    console.error('Manifest validation failed:', e.message);
    process.exit(1);
  }

  // 부분 빌드 준비: 대상 키 검증 + 이전 레지스트리 확보
  let priorRegistry = null;
  const validSubjectKeys = new Set(manifest.subjects.map(s => s.key));
  if (isPartial) {
    const unknown = onlyKeys.filter(k => !validSubjectKeys.has(k));
    if (unknown.length > 0) {
      console.error(`--only: 매니페스트에 없는 과목 키: ${unknown.join(', ')}`);
      process.exit(1);
    }
    priorRegistry = loadPriorRegistry();
    if (!priorRegistry) {
      console.error('--only(부분 빌드)는 기존 data/registry.js가 있어야 나머지 과목을 보존할 수 있습니다.');
      console.error('먼저 전체 빌드(npm run build:data)를 1회 실행하세요.');
      process.exit(1);
    }
    console.log(`Partial build for subject(s): ${onlyKeys.join(', ')}`);
  }

  const onlySet = isPartial ? new Set(onlyKeys) : null;
  const shouldBuildSubject = (key) => !isPartial || onlySet.has(key);
  const shouldBuildExam = (exam) => !isPartial || onlySet.has(exam.subject);

  const priorSubjectByKey = {};
  const priorExamByKey = {};
  if (priorRegistry) {
    (priorRegistry.subjects || []).forEach(s => { priorSubjectByKey[s.key] = s; });
    (priorRegistry.exams || []).forEach(e => { priorExamByKey[e.key] = e; });
  }

  const registry = {
    schemaVersion: 1,
    contentYear: manifest.contentYear,
    generatedAt: new Date().toISOString(),
    subjects: [],
    exams: [],
    ingredients: {}
  };

  // 부분 빌드면 이전 통계를 기반으로 시작(미재빌드 항목의 baseline 보존)
  const statsPath = path.join(__dirname, '.last-stats.json');
  const currentStats = isPartial
    ? loadPriorStats(statsPath)
    : { subjects: {}, exams: {} };

  const generatedFiles = [];
  const allMarkerWarnings = [];

  // 2. Subjects (manifest 순서 유지, 미대상은 이전 레지스트리 항목 재사용)
  const textbookPlugin = require('./plugins/textbook.plugin');
  manifest.subjects.forEach(subj => {
    if (!shouldBuildSubject(subj.key)) {
      const prior = priorSubjectByKey[subj.key];
      if (!prior) {
        console.error(`부분 빌드: 이전 레지스트리에 과목 "${subj.key}" 항목이 없습니다. 전체 빌드가 필요합니다.`);
        process.exit(1);
      }
      registry.subjects.push(prior);
      console.log(`Skipping Subject: ${subj.key} (기존 번들 유지)`);
      return;
    }

    console.log(`Building Subject: ${subj.key} (${subj.name})...`);
    try {
      const data = textbookPlugin.build(subj, ctx);
      validateSubjectData(subj.key, data);

      // #3: 마커 감시 경고 수집 (비열거 필드라 산출물/해시에는 미포함)
      if (data._warnings && data._warnings.length > 0) {
        allMarkerWarnings.push({ subject: subj.key, files: data._warnings });
      }

      const hash = getContentHash(data);

      // [정합성] 교재/카드/퀴즈는 런타임에 content/*.md 를 파싱해 로드한다
      // (src/data-loader.js loadSubject → buildSubjectData). 따라서 사전 빌드된
      // data/subjects/*.js 번들은 더 이상 어디에서도 로드되지 않는다.
      //  - 번들 파일 생성을 중단하고(불필요한 ~1MB 산출물 제거),
      //  - 남아있을 수 있는 구 번들만 정리하며,
      //  - registry 에 bundle/global 을 넣지 않아 "배포에서 제외된(=404) 번들 경로"를
      //    광고하지 않는다. (exam/ingredients 는 여전히 번들 로드 방식이므로 그대로 유지)
      clearOldBundles(SUBJECTS_OUT_DIR, `${subj.key}.`);

      registry.subjects.push({
        key: subj.key,
        order: subj.order,
        name: subj.name,
        shortName: subj.shortName || subj.name,
        contentHash: hash,
        stats: {
          cards: data.cards.length,
          quizzes: data.quizzes.length,
          chapters: data.chapters.length
        }
      });

      currentStats.subjects[subj.key] = {
        cards: data.cards.length,
        quizzes: data.quizzes.length
      };

      console.log(`- Success: Cards: ${data.cards.length}, Quizzes: ${data.quizzes.length}`);
    } catch (e) {
      console.error(`Build failed for subject ${subj.key}:`, e.stack);
      process.exit(1);
    }
  });

  // 3. Exams (과목이 대상일 때만 재빌드, 나머지는 이전 항목 재사용)
  const examsPlugin = require('./plugins/exams.plugin');
  manifest.exams.forEach(exam => {
    if (!shouldBuildExam(exam)) {
      const prior = priorExamByKey[exam.key];
      if (!prior) {
        console.error(`부분 빌드: 이전 레지스트리에 시험 "${exam.key}" 항목이 없습니다. 전체 빌드가 필요합니다.`);
        process.exit(1);
      }
      registry.exams.push(prior);
      return;
    }

    console.log(`Building Exam: ${exam.key} (${exam.title})...`);
    try {
      const data = examsPlugin.build(exam, ctx);
      validateExamData(exam.key, data);

      const hash = getContentHash(data);
      const outputFilename = `${exam.key}.${hash}.js`;
      const outputPath = path.join(EXAMS_OUT_DIR, outputFilename);

      clearOldBundles(EXAMS_OUT_DIR, `${exam.key}.`);

      const jsContent = `// 자동 생성된 시험 데이터입니다. 수정하지 마십시오.\nvar EXAM_DATA_${exam.key} = ${JSON.stringify(data, null, 2)};\n`;
      fs.writeFileSync(outputPath, jsContent, 'utf-8');

      registry.exams.push({
        key: exam.key,
        subject: exam.subject,
        part: exam.part,
        title: exam.title,
        file: exam.file,
        bundle: `./data/exams/${outputFilename}`,
        global: `EXAM_DATA_${exam.key}`,
        contentHash: hash,
        stats: {
          questions: data.questions.length
        }
      });

      currentStats.exams[exam.key] = {
        questions: data.questions.length
      };

      generatedFiles.push(`./data/exams/${outputFilename}`);
      console.log(`- Success: Questions: ${data.questions.length}`);
    } catch (e) {
      console.error(`Build failed for exam ${exam.key}:`, e.message);
      process.exit(1);
    }
  });

  // 4. Ingredients (전체 빌드 또는 이전 항목이 없을 때만 재빌드)
  const ingredientsPlugin = require('./plugins/ingredients.plugin');
  if (!isPartial || !priorRegistry.ingredients || !priorRegistry.ingredients.bundle) {
    console.log('Building Ingredients Database...');
    try {
      const data = ingredientsPlugin.build(manifest, ctx);
      validateIngredientsData(data);

      const hash = getContentHash(data);
      const outputFilename = `ingredients_data.${hash}.js`;
      const outputPath = path.join(DATA_DIR, outputFilename);

      clearOldBundles(DATA_DIR, 'ingredients_data.');

      const jsContent = `// 자동 생성된 화장품 원료 데이터 파일입니다. 수정하지 마십시오.\nvar INGREDIENTS_DATA = ${JSON.stringify(data, null, 2)};\n`;
      fs.writeFileSync(outputPath, jsContent, 'utf-8');

      registry.ingredients = {
        bundle: `./data/${outputFilename}`,
        global: 'INGREDIENTS_DATA',
        contentHash: hash,
        stats: { count: data.length }
      };

      generatedFiles.push(`./data/${outputFilename}`);
      console.log(`- Success: Total ingredients parsed: ${data.length}`);
    } catch (e) {
      console.error('Build failed for ingredients database:', e.message);
      process.exit(1);
    }
  } else {
    registry.ingredients = priorRegistry.ingredients;
    console.log('Skipping Ingredients Database (기존 번들 유지)');
  }

  // 5. Resources (추천 링크 — manifest에서 registry로 전달)
  if (manifest.resources) {
    registry.resources = manifest.resources;
  }

  // 6. Output Registry File
  const registryPath = path.join(DATA_DIR, 'registry.js');
  const registryJsContent = `// 자동 생성된 데이터 레지스트리 파일입니다. 수정하지 마십시오.
/** @type {import('../src/types.js').DataRegistry} */
export const DATA_REGISTRY = ${JSON.stringify(registry, null, 2)};
if (typeof window !== 'undefined') {
  window.DATA_REGISTRY = DATA_REGISTRY;
}
`;
  fs.writeFileSync(registryPath, registryJsContent, 'utf-8');
  console.log('Registry file generated at: data/registry.js');

  // 6. Service Worker 갱신
  //  - DATA_ASSETS: 경량 프리캐시 세트만 (무거운 번들은 온디맨드 캐싱, MODULAR_DESIGN 4-3)
  //  - CACHE_VERSION: 쉘/CDN 캐시 무효화용 (데이터 캐시는 sw.js의 DATA_CACHE_VERSION로 분리)
  const swPath = path.join(WORKSPACE_DIR, 'sw.js');
  if (fs.existsSync(swPath)) {
    console.log('Updating sw.js (DATA_ASSETS/CACHE_VERSION)...');
    let swContent = fs.readFileSync(swPath, 'utf-8');

    const assetsToCache = [
      './data/registry.js',
      './data/audio_manifest.js'
    ];
    void generatedFiles; // 참고용 수집 — 프리캐시 목록에는 포함하지 않음

    const assetsBlock = 'const DATA_ASSETS = [\n' + assetsToCache.map(a => `  '${a}'`).join(',\n') + '\n];';
    swContent = swContent.replace(/const DATA_ASSETS = \[[^\]]*\];?/s, assetsBlock);

    fs.writeFileSync(swPath, swContent, 'utf-8');
    console.log('sw.js pre-cache assets updated.');
    
    // 자동화된 서비스 워커 버전 관리 (stampSwVersion) 연동
    try {
      const { stampSwVersion } = require('./stamp-sw-version');
      stampSwVersion({ swPath: swPath });
    } catch (err) {
      console.warn('Warning: Failed to stamp sw version:', err.message);
    }
  } else {
    console.warn('Warning: sw.js not found, skipping asset injection.');
  }

  // 7. 마커 감시 경고 리포트 (#3)
  printMarkerWarnings(allMarkerWarnings, console);

  // 8. 통계 이상 감지 (부분 빌드 시 병합된 currentStats 저장으로 baseline 보존)
  checkStatsAnomaly(statsPath, currentStats, console);

  console.log('--- Build Completed Successfully ---');
}

main();
