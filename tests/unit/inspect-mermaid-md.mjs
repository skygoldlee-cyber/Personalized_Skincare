import fs from 'fs';
const c = fs.readFileSync('content/교재/law/1과목_화장품법의이해.md', 'utf8');
const lines = c.split(/\r?\n/);
let inMermaid = false;
let blockNum = 0;
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith('```mermaid')) {
        inMermaid = true;
        blockNum++;
        console.log(`\n=== mermaid block ${blockNum} (line ${i+1}) ===`);
        continue;
    }
    if (inMermaid && l.trim().startsWith('```')) {
        inMermaid = false;
        continue;
    }
    if (inMermaid) {
        // Show exact characters: spaces shown as ·, tabs as →
        const visual = l.replace(/ /g, '·').replace(/\t/g, '→');
        console.log(`line ${i+1}: [${visual}]`);
    }
}
