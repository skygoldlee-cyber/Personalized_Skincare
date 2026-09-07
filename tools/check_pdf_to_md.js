const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const refMdDir = path.join(ROOT, 'content/참조자료/ref_md');
const pdfDir = path.join(ROOT, 'content/참조자료/법령원문');

console.log('=== PDF → MD 매핑 ===\n');

// List PDF files
const pdfs = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
console.log('PDF files:', pdfs.length);

// List ref_md subdirectories and their .md files
const refMdSubs = fs.readdirSync(refMdDir).filter(f => {
    return fs.statSync(path.join(refMdDir, f)).isDirectory();
});

const mapping = [];

for (const pdf of pdfs) {
    const baseName = pdf.replace(/\.pdf$/, '');
    // Find matching ref_md subdirectory
    const matchDir = refMdSubs.find(d => d === baseName);
    if (matchDir) {
        const subDirPath = path.join(refMdDir, matchDir);
        const mdFiles = fs.readdirSync(subDirPath).filter(f => f.endsWith('.md'));
        if (mdFiles.length > 0) {
            const mdRelPath = `content/참조자료/ref_md/${matchDir}/${mdFiles[0]}`;
            const mdLines = fs.readFileSync(path.join(subDirPath, mdFiles[0]), 'utf-8').split('\n').length;
            mapping.push({
                pdf: pdf,
                mdDir: matchDir,
                mdFile: mdFiles[0],
                mdRelPath: mdRelPath,
                mdLines: mdLines,
            });
            console.log(`✅ ${pdf}`);
            console.log(`   → ${mdRelPath} (${mdLines} lines)`);
        } else {
            console.log(`❌ ${pdf} - no .md file in ${matchDir}`);
        }
    } else {
        // Try partial match
        const partial = refMdSubs.find(d => d.includes(baseName.substring(0, 10)));
        if (partial) {
            const subDirPath = path.join(refMdDir, partial);
            const mdFiles = fs.readdirSync(subDirPath).filter(f => f.endsWith('.md'));
            if (mdFiles.length > 0) {
                const mdRelPath = `content/참조자료/ref_md/${partial}/${mdFiles[0]}`;
                const mdLines = fs.readFileSync(path.join(subDirPath, mdFiles[0]), 'utf-8').split('\n').length;
                mapping.push({
                    pdf: pdf,
                    mdDir: partial,
                    mdFile: mdFiles[0],
                    mdRelPath: mdRelPath,
                    mdLines: mdLines,
                });
                console.log(`✅ (partial) ${pdf}`);
                console.log(`   → ${mdRelPath} (${mdLines} lines)`);
            }
        } else {
            console.log(`❌ ${pdf} - no matching ref_md directory`);
        }
    }
}

console.log(`\nMapped: ${mapping.length}/${pdfs.length}`);

// Output mapping as JSON for use by replacement script
fs.writeFileSync(path.join(__dirname, 'pdf_to_md_mapping.json'), JSON.stringify(mapping, null, 2), 'utf-8');
console.log('\nMapping saved to tools/pdf_to_md_mapping.json');
