const fs = require('fs');
const path = require('path');

function loadAndValidateManifest(manifestPath, workspaceDir) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found at: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${manifest.schemaVersion}`);
  }

  const subjectKeys = new Set();
  const examKeys = new Set();

  // Validate subjects
  if (!Array.isArray(manifest.subjects)) {
    throw new Error('manifest.json: "subjects" must be an array.');
  }

  manifest.subjects.forEach((subj, sIdx) => {
    const prefix = `subjects[${sIdx}] (${subj.key || 'unknown'})`;
    if (!subj.key || !subj.name || !subj.dir || !Array.isArray(subj.chapters)) {
      throw new Error(`${prefix}: Missing key, name, dir, or chapters.`);
    }

    if (subjectKeys.has(subj.key)) {
      throw new Error(`Duplicate subject key: ${subj.key}`);
    }
    subjectKeys.add(subj.key);

    // Validate chapters
    subj.chapters.forEach((chap, cIdx) => {
      const cPrefix = `${prefix}.chapters[${cIdx}] (${chap.key || 'unknown'})`;
      if (!chap.key || !chap.title || !chap.file) {
        throw new Error(`${cPrefix}: Missing key, title, or file.`);
      }

      // Check file existence
      const filePath = path.join(workspaceDir, 'content', subj.dir, chap.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`${cPrefix}: File does not exist at: ${filePath}`);
      }
    });
  });

  // Validate exams
  if (!Array.isArray(manifest.exams)) {
    throw new Error('manifest.json: "exams" must be an array.');
  }

  manifest.exams.forEach((exam, eIdx) => {
    const prefix = `exams[${eIdx}] (${exam.key || 'unknown'})`;
    if (!exam.key || !exam.subject || typeof exam.part !== 'number' || !exam.title || !exam.file) {
      throw new Error(`${prefix}: Missing key, subject, part, title, or file.`);
    }

    if (examKeys.has(exam.key)) {
      throw new Error(`Duplicate exam key: ${exam.key}`);
    }
    examKeys.add(exam.key);

    if (!subjectKeys.has(exam.subject)) {
      throw new Error(`${prefix}: References undefined subject key: ${exam.subject}`);
    }

    // Check file existence
    const filePath = path.join(workspaceDir, 'content', '문제은행', exam.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${prefix}: File does not exist at: ${filePath}`);
    }
  });

  return manifest;
}

module.exports = {
  loadAndValidateManifest
};
