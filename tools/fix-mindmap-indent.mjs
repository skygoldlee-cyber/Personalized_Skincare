import fs from 'fs';

const FILES = [
    'content/교재/law/1과목_화장품법의이해.md',
    'content/교재/manufacturing/2과목_제조및품질관리.md',
    'content/교재/manufacturing/2과목_제조및품질관리_이야기형.md',
    'content/교재/safety/3과목_유통화장품안전관리.md',
    'content/교재/safety/3과목_유통화장품안전관리_이야기형.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해.md',
    'content/교재/understanding/4과목_맞춤형화장품의이해_이야기형.md',
];

function fixMindmapIndentation(content) {
    const lines = content.split(/\r?\n/);
    const output = [];
    let i = 0;
    let fixedCount = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect mermaid mindmap block start
        if (trimmed.startsWith('```mermaid')) {
            // Look ahead to check if it's a mindmap
            let blockEnd = -1;
            let isMindmap = false;
            for (let j = i + 1; j < lines.length; j++) {
                const t = lines[j].trim();
                if (t.startsWith('```')) {
                    blockEnd = j;
                    break;
                }
                if (!isMindmap && t.startsWith('mindmap')) {
                    isMindmap = true;
                }
            }

            if (isMindmap && blockEnd > 0) {
                // Check if the mindmap already has proper indentation (more than 1 space for root)
                let needsFix = false;
                for (let j = i + 1; j < blockEnd; j++) {
                    const l = lines[j];
                    if (l.trim() && !l.trim().startsWith('mindmap')) {
                        // Check indentation: if root((...)) is at 1 space, needs fix
                        if (l.trim().startsWith('root((') && l.startsWith(' ')) {
                            const indent = l.length - l.trimStart().length;
                            if (indent <= 1) {
                                needsFix = true;
                            }
                        }
                        break;
                    }
                }

                if (needsFix) {
                    // Find the table after this block
                    let tableStart = -1;
                    let tableEnd = -1;
                    for (let j = blockEnd + 1; j < Math.min(blockEnd + 15, lines.length); j++) {
                        const t = lines[j].trim();
                        if (t.startsWith('|') && t.includes('---')) {
                            // Found table separator, table starts 1 line before
                            tableStart = j - 1;
                            // Find table end
                            for (let k = j + 1; k < lines.length; k++) {
                                if (!lines[k].trim().startsWith('|')) {
                                    tableEnd = k;
                                    break;
                                }
                            }
                            if (tableEnd < 0) tableEnd = lines.length;
                            break;
                        }
                        // Skip non-table lines (blank, >, etc)
                        if (t && !t.startsWith('>') && !t.startsWith('|') && !t.startsWith('---')) {
                            break;
                        }
                    }

                    if (tableStart > 0 && tableEnd > tableStart) {
                        // Parse table header to determine column count
                        const headerLine = lines[tableStart].trim();
                        const cols = headerLine.split('|').filter(c => c.trim()).length;
                        
                        // Parse table rows
                        const tableRows = [];
                        for (let j = tableStart + 2; j < tableEnd; j++) {
                            const row = lines[j].trim();
                            if (!row.startsWith('|')) continue;
                            const cells = row.split('|').map(c => c.trim()).filter(c => c);
                            // Remove empty first/last from split
                            tableRows.push(cells);
                        }

                        // Build hierarchy from table
                        // Cols can be 2 (대분류/중분류), 3 (대분류/중분류/소분류), or more
                        const mindmapLines = ['mindmap'];
                        const seen = new Set();
                        
                        // Get root text from original mindmap
                        let rootText = '';
                        for (let j = i + 1; j < blockEnd; j++) {
                            const t = lines[j].trim();
                            if (t.startsWith('root((')) {
                                rootText = t;
                                break;
                            }
                        }
                        if (rootText) {
                            mindmapLines.push(' ' + rootText);
                        }

                        // Build mindmap from table rows
                        for (const row of tableRows) {
                            for (let level = 0; level < row.length; level++) {
                                const cellText = row[level].trim();
                                if (cellText === '—' || cellText === '-' || cellText === '') continue;
                                
                                const key = `${level}:${cellText}`;
                                if (seen.has(key)) continue;
                                seen.add(key);
                                
                                // level 0 → indent 2, level 1 → indent 3, etc.
                                const indent = ' '.repeat(level + 2);
                                mindmapLines.push(indent + cellText);
                            }
                        }

                        // Output fixed mindmap block
                        output.push('```mermaid');
                        output.push(...mindmapLines);
                        output.push('```');
                        fixedCount++;
                        i = blockEnd + 1;
                        continue;
                    }
                }
            }
        }

        output.push(line);
        i++;
    }

    return { content: output.join('\n'), fixedCount };
}

// Process files
let totalFixed = 0;
for (const file of FILES) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const { content: fixed, fixedCount } = fixMindmapIndentation(content);
        if (fixedCount > 0) {
            fs.writeFileSync(file, fixed, 'utf8');
            console.log(`${file}: fixed ${fixedCount} mindmap blocks`);
            totalFixed += fixedCount;
        } else {
            console.log(`${file}: no fixes needed`);
        }
    } catch (e) {
        console.error(`${file}: ERROR - ${e.message}`);
    }
}
console.log(`\nTotal: ${totalFixed} mindmap blocks fixed`);
