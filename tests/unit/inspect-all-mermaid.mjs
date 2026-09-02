import fs from 'fs';
import path from 'path';

const FILES = [
    'content/교재/law/1과목_화장품법의이해.md',
    'content/교재/law/1과목_화장품법의이해_이야기형.md',
    'content/교재/manufacturing/2과목_제조및품질관리.md',
    'content/교재/manufacturing/2과목_제조및품질관리_이야기형.md',
    'content/교재/safety/3과목_유해화장품안전관리.md',
    'content/교재/safety/3과목_유해화장품안전관리_이야기형.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해_이야기형.md',
];

for (const file of FILES) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    let inMermaid = false;
    let blockType = '';
    let blockStart = -1;
    let blockLines = [];
    let hasTable = false;
    let mindmapCount = 0;
    let flowchartCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const trimmed = l.trim();

        if (trimmed.startsWith('```mermaid')) {
            inMermaid = true;
            blockStart = i;
            blockLines = [];
            blockType = '';
            continue;
        }

        if (inMermaid && trimmed.startsWith('```')) {
            inMermaid = false;
            if (blockType === 'mindmap') {
                mindmapCount++;
                // Check if there's a table within 5 lines after the block
                let tableFound = false;
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    if (lines[j].trim().startsWith('|') && lines[j].includes('---')) {
                        tableFound = true;
                        break;
                    }
                    if (lines[j].trim().startsWith('|')) {
                        // Keep looking for separator
                    } else if (lines[j].trim() && !lines[j].trim().startsWith('>')) {
                        break;
                    }
                }
                console.log(`${file}: mindmap at line ${blockStart+1}, ${blockLines.length} lines, table after: ${tableFound}`);
            } else if (blockType === 'flowchart') {
                flowchartCount++;
            }
            continue;
        }

        if (inMermaid) {
            if (blockType === '' && trimmed) {
                blockType = trimmed.split(/\s+/)[0];
            }
            blockLines.push(l);
        }
    }
    console.log(`${file}: ${mindmapCount} mindmaps, ${flowchartCount} flowcharts\n`);
}
