const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dirs = [
    'content/교재/law',
    'content/교재/manufacturing',
    'content/교재/safety',
    'content/교재/understanding'
];

let total = 0;
const results = [];

for (const d of dirs) {
    const dp = path.resolve(ROOT, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp)) {
        if (!f.endsWith('.md')) continue;
        const fp = path.join(dp, f);
        const c = fs.readFileSync(fp, 'utf-8');
        const matches = c.match(/참조 PDF.*?\.pdf/g);
        if (matches) {
            total += matches.length;
            results.push({ file: f, dir: d, count: matches.length });
        }
    }
}

console.log('Total PDF refs:', total);
results.forEach(r => console.log(`  ${r.dir}/${r.file}: ${r.count}`));

// Also extract unique PDF link patterns
const allPdfLinks = new Set();
for (const d of dirs) {
    const dp = path.resolve(ROOT, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp)) {
        if (!f.endsWith('.md')) continue;
        const fp = path.join(dp, f);
        const c = fs.readFileSync(fp, 'utf-8');
        const re = /참조 PDF.*?\[([^\]]+)\]\(([^)]+\.pdf)\)/g;
        let m;
        while ((m = re.exec(c)) !== null) {
            allPdfLinks.add(m[2]);
        }
    }
}

console.log('\nUnique PDF paths:');
const sorted = [...allPdfLinks].sort();
sorted.forEach(p => console.log(`  ${p}`));
console.log('Total unique:', sorted.length);
