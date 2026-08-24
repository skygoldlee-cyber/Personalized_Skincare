$WorkspaceDir = Split-Path -Parent $PSScriptRoot
if (!$WorkspaceDir) { $WorkspaceDir = (Get-Location).Path }

# Define the HTML template as a single string
$HtmlTemplate = @'
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}} | Cosmetic Pass Master</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome for Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-app: #0b0f19;
            --bg-card: rgba(31, 41, 55, 0.45);
            --border-color: rgba(255, 255, 255, 0.08);
            --color-primary: #06b6d4;      /* Luminous Cyan */
            --color-secondary: #8b5cf6;    /* Neon Violet */
            --color-success: #10b981;      /* Emerald Green */
            --color-warning: #f59e0b;      /* Amber Gold */
            --color-text-main: #f3f4f6;    /* Warm White */
            --color-text-muted: #9ca3af;   /* Muted Gray */
            --radius-md: 12px;
            --radius-sm: 8px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-app);
            color: var(--color-text-main);
            font-family: 'Noto Sans KR', 'Outfit', sans-serif;
            line-height: 1.8;
            padding: 0;
            margin: 0;
            display: flex;
            justify-content: center;
        }

        /* Container & Grid layout */
        .container {
            max-width: 1280px;
            width: 100%;
            display: flex;
            gap: 30px;
            padding: 40px 20px;
            position: relative;
        }

        .main-content {
            flex: 1;
            min-width: 0;
            background: var(--bg-card);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .sidebar {
            width: 300px;
            position: sticky;
            top: 40px;
            height: fit-content;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 24px;
            max-height: calc(100vh - 80px);
            overflow-y: auto;
        }

        /* Scrollbar customization */
        .sidebar::-webkit-scrollbar {
            width: 6px;
        }
        .sidebar::-webkit-scrollbar-track {
            background: transparent;
        }
        .sidebar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
        .sidebar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        /* Typography */
        h1, h2, h3, h4 {
            color: #ffffff;
            font-weight: 700;
            margin-top: 1.6em;
            margin-bottom: 0.8em;
            letter-spacing: -0.02em;
        }

        h1 {
            font-size: 2.2rem;
            border-bottom: 2px solid var(--color-primary);
            padding-bottom: 15px;
            margin-top: 0;
            background: linear-gradient(135deg, #ffffff 0%, var(--color-primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h2 {
            font-size: 1.6rem;
            border-left: 4px solid var(--color-secondary);
            padding-left: 15px;
            margin-top: 2em;
        }

        h3 {
            font-size: 1.25rem;
            color: var(--color-primary);
            margin-top: 1.8em;
        }

        p {
            margin-bottom: 1.2em;
            color: #d1d5db;
            text-align: justify;
        }

        /* Lists */
        ul, ol {
            margin-bottom: 1.5em;
            padding-left: 24px;
        }

        li {
            margin-bottom: 0.6em;
            color: #d1d5db;
        }

        li strong {
            color: #ffffff;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0 32px 0;
            border-radius: var(--radius-sm);
            overflow: hidden;
            border: 1px solid var(--border-color);
        }

        th {
            background-color: rgba(6, 182, 212, 0.1);
            color: var(--color-primary);
            font-weight: 700;
            text-align: left;
            padding: 14px 18px;
            border-bottom: 2px solid var(--border-color);
            font-size: 0.95rem;
        }

        td {
            padding: 14px 18px;
            border-bottom: 1px solid var(--border-color);
            color: #d1d5db;
            font-size: 0.9rem;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background-color: rgba(255, 255, 255, 0.02);
        }

        /* Blockquotes */
        blockquote {
            background: rgba(139, 92, 246, 0.05);
            border-left: 4px solid var(--color-secondary);
            padding: 16px 24px;
            margin: 24px 0;
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }

        blockquote p {
            margin-bottom: 0.5em;
            color: #e5e7eb;
            font-style: italic;
        }

        blockquote p:last-child {
            margin-bottom: 0;
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: -0.01em;
            margin: 0 4px;
            vertical-align: middle;
        }

        .badge.gichul {
            background: rgba(6, 182, 212, 0.15);
            color: var(--color-primary);
            border: 1px solid rgba(6, 182, 212, 0.3);
        }

        .badge.jungyo {
            background: rgba(245, 158, 11, 0.15);
            color: var(--color-warning);
            border: 1px solid rgba(245, 158, 11, 0.3);
        }

        /* Code */
        code {
            font-family: 'Consolas', 'Courier New', monospace;
            background-color: rgba(255, 255, 255, 0.08);
            color: #ff79c6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        /* Sidebar & TOC */
        .sidebar h4 {
            color: #ffffff;
            font-size: 1.1rem;
            margin-top: 0;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .toc-list {
            list-style: none;
            padding-left: 0;
            margin-bottom: 0;
        }

        .toc-item {
            margin-bottom: 8px;
        }

        .toc-link {
            color: var(--color-text-muted);
            text-decoration: none;
            font-size: 0.85rem;
            transition: all 0.2s;
            display: block;
            line-height: 1.4;
        }

        .toc-link:hover {
            color: var(--color-primary);
            padding-left: 5px;
        }

        .toc-link.active {
            color: var(--color-primary);
            font-weight: 700;
        }

        .toc-item.depth-3 {
            padding-left: 15px;
        }

        /* Actions & Navigation */
        .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
        }

        .action-group {
            display: flex;
            gap: 10px;
        }

        .btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--color-text-main);
            padding: 8px 16px;
            border-radius: var(--radius-sm);
            cursor: pointer;
            text-decoration: none;
            font-size: 0.85rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }

        .btn:hover {
            background: rgba(6, 182, 212, 0.1);
            border-color: var(--color-primary);
            color: var(--color-primary);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
            border: none;
            color: #ffffff;
            font-weight: 500;
        }

        .btn-primary:hover {
            opacity: 0.9;
            color: #ffffff;
        }

        .floating-top {
            position: fixed;
            bottom: 40px;
            right: 40px;
            background: var(--color-secondary);
            color: #ffffff;
            width: 45px;
            height: 45px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
            border: none;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s;
            z-index: 100;
        }

        .floating-top.show {
            opacity: 1;
            transform: translateY(0);
        }

        .floating-top:hover {
            background: #7c3aed;
            box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
        }

        /* Divider */
        hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 30px 0;
        }

        /* Performance Optimization (New) */
        .study-section {
            content-visibility: auto;
            contain-intrinsic-size: 1px 1000px;
            margin-bottom: 2rem;
        }

        /* Media queries */
        @media (max-width: 992px) {
            .container {
                flex-direction: column-reverse;
                padding: 20px 10px;
            }

            .sidebar {
                width: 100%;
                position: static;
                max-height: none;
                margin-bottom: 20px;
            }

            .main-content {
                padding: 25px;
            }
        }

        /* Print styling */
        @media print {
            body {
                background: #ffffff;
                color: #000000;
                font-size: 12pt;
            }

            .container {
                padding: 0;
                display: block;
            }

            .sidebar, .actions, .floating-top {
                display: none !important;
            }

            .main-content {
                border: none;
                background: none;
                padding: 0;
                box-shadow: none;
            }

            h1, h2, h3, h4 {
                color: #000000 !important;
                page-break-after: avoid;
            }

            h1 {
                background: none;
                -webkit-text-fill-color: initial;
                border-bottom: 2px solid #000000;
            }

            h2 {
                border-left: 4px solid #000000;
            }

            table {
                border: 1px solid #000000 !important;
                page-break-inside: avoid;
                width: 100%;
            }

            th, td {
                border: 1px solid #000000 !important;
                color: #000000 !important;
                background: none !important;
                padding: 10px !important;
            }

            blockquote {
                border-left: 4px solid #000000;
                background: #f3f4f6;
                color: #000000 !important;
            }

            .badge {
                border: 1px solid #000000 !important;
                color: #000000 !important;
                background: none !important;
            }
            .study-section {
                content-visibility: visible !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <main class="main-content">
            <div class="actions">
                <div class="action-group">
                    <a href="../index.html" class="btn"><i class="fa-solid fa-house"></i> 학습 홈</a>
                    <!-- 매뉴얼은 앱 남부 런타임 뷰어(ManualViewer)로 표시되므로 앱으로 이동 -->
                    <a href="../index.html" class="btn"><i class="fa-solid fa-book"></i> 매뉴얼 (앱에서 열기)</a>
                </div>
                <button onclick="window.print()" class="btn btn-primary"><i class="fa-solid fa-print"></i> 인쇄 / PDF 저장</button>
            </div>
            
            <article id="article-body">
                {{CONTENT}}
            </article>
        </main>
        
        <aside class="sidebar">
            <h4><i class="fa-solid fa-list-ul"></i> 목차 (TOC)</h4>
            <ul class="toc-list" id="toc-list">
                <!-- TOC items generated dynamically by JS -->
            </ul>
        </aside>
    </div>

    <button class="floating-top" id="btn-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
        <i class="fa-solid fa-arrow-up"></i>
    </button>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const article = document.getElementById('article-body');
            
            // Group content dynamically under H2 headings to optimize rendering performance (content-visibility: auto)
            const children = Array.from(article.children);
            let currentSection = null;
            children.forEach(child => {
                if (child.tagName === 'H1') return;
                if (child.tagName === 'H2') {
                    currentSection = document.createElement('section');
                    currentSection.className = 'study-section';
                    article.insertBefore(currentSection, child);
                    currentSection.appendChild(child);
                } else if (currentSection) {
                    currentSection.appendChild(child);
                }
            });

            const headings = article.querySelectorAll('h2, h3');
            const tocList = document.getElementById('toc-list');
            
            if (headings.length === 0) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.style.display = 'none';
                return;
            }
            
            headings.forEach((heading, idx) => {
                if (!heading.id) {
                    heading.id = 'heading-' + idx;
                }
                
                const li = document.createElement('li');
                li.className = 'toc-item depth-' + (heading.tagName === 'H2' ? '2' : '3');
                
                const a = document.createElement('a');
                a.href = '#' + heading.id;
                a.className = 'toc-link';
                a.textContent = heading.textContent.replace(/🔖기출|📌중요/g, '').trim();
                
                li.appendChild(a);
                tocList.appendChild(li);
            });

            const tocLinks = document.querySelectorAll('.toc-link');
            const options = {
                root: null,
                rootMargin: '0px 0px -60% 0px',
                threshold: 0
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        tocLinks.forEach(link => {
                            if (link.getAttribute('href') === '#' + id) {
                                link.classList.add('active');
                            } else {
                                link.classList.remove('active');
                            }
                        });
                    }
                });
            }, options);

            headings.forEach(heading => observer.observe(heading));
        });

        const btnTop = document.getElementById('btn-top');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btnTop.classList.add('show');
            } else {
                btnTop.classList.remove('show');
            }
        });
    </script>
</body>
</html>
'@

function Convert-InlineMarkdown {
    param([string]$text)
    if (!$text) { return "" }

    # Bold: **text**
    $t = [regex]::Replace($text, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    
    # Inline code: `code`
    $t = [regex]::Replace($t, '`([^`]+)`', '<code>$1</code>')

    # Badges
    $t = $t -replace '🔖기출', '<span class="badge gichul"><i class="fa-solid fa-bookmark"></i> 기출</span>'
    $t = $t -replace '📌중요', '<span class="badge jungyo"><i class="fa-solid fa-thumbtack"></i> 중요</span>'

    # Support simple markdown links [text](url)
    $t = [regex]::Replace($t, '\[([^\]]+)\]\(([^)]+)\)', '<a href="$2">$1</a>')

    return $t
}

function Convert-MarkdownToHtml {
    param([string]$md)

    $lines = $md -split "\r?\n"
    $html = New-Object System.Text.StringBuilder
    
    $inTable = $false
    $inList = $false
    $listType = "" # "ul" or "ol"
    $inQuote = $false

    [void](& {
        for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i].Trim()

        # Handle Blockquotes
        if ($line.StartsWith(">")) {
            if (-not $inQuote) {
                if ($inTable) { $html.AppendLine("</tbody>`n</table>"); $inTable = $false }
                if ($inList) { $html.AppendLine("</$listType>"); $inList = $false }
                $html.AppendLine("<blockquote>")
                $inQuote = $true
            }
            $cleanLine = $line.Substring(1).Trim()
            $parsedLine = Convert-InlineMarkdown $cleanLine
            $html.AppendLine("<p>$parsedLine</p>")
            continue
        } else {
            if ($inQuote) {
                $html.AppendLine("</blockquote>")
                $inQuote = $false
            }
        }

        # Handle Separators (horizontal rule)
        if ($line -eq "---" -or $line -eq "***") {
            if ($inTable) { $html.AppendLine("</tbody>`n</table>"); $inTable = $false }
            if ($inList) { $html.AppendLine("</$listType>"); $inList = $false }
            $html.AppendLine("<hr />")
            continue
        }

        # Handle Headings
        if ($line.StartsWith("#")) {
            if ($inTable) { $html.AppendLine("</tbody>`n</table>"); $inTable = $false }
            if ($inList) { $html.AppendLine("</$listType>"); $inList = $false }

            $level = 0
            while ($level -lt $line.Length -and $line[$level] -eq '#') { $level++ }
            $headingText = $line.Substring($level).Trim()
            $parsedText = Convert-InlineMarkdown $headingText
            $html.AppendLine("<h$level>$parsedText</h$level>")
            continue
        }

        # Handle Tables
        if ($line.StartsWith("|") -and $line.EndsWith("|")) {
            if ($inList) { $html.AppendLine("</$listType>"); $inList = $false }
            
            # Divider row?
            if ($line -match '^[|\s:-]+$') {
                continue
            }

            # Split cells
            $cells = $line.Split('|') | ForEach-Object { $_.Trim() }
            if ($cells.Count -ge 2) {
                $cells = $cells[1..($cells.Count - 2)]
            }

            if (-not $inTable) {
                $inTable = $true
                $html.AppendLine("<table>")
                $html.AppendLine("<thead>")
                $html.AppendLine("<tr>")
                foreach ($cell in $cells) {
                    $parsedCell = Convert-InlineMarkdown $cell
                    $html.AppendLine("<th>$parsedCell</th>")
                }
                $html.AppendLine("</tr>")
                $html.AppendLine("</thead>")
                $html.AppendLine("<tbody>")
            } else {
                $html.AppendLine("<tr>")
                foreach ($cell in $cells) {
                    $parsedCell = Convert-InlineMarkdown $cell
                    $html.AppendLine("<td>$parsedCell</td>")
                }
                $html.AppendLine("</tr>")
            }
            continue
        } else {
            if ($inTable) {
                $html.AppendLine("</tbody>")
                $html.AppendLine("</table>")
                $inTable = $false
            }
        }

        # Handle Lists (Unordered)
        $isUlistItem = $line -match '^[-*]\s+(.*)'
        # Handle Lists (Ordered)
        $isOlistItem = $line -match '^\d+\.\s+(.*)'

        if ($isUlistItem -or $isOlistItem) {
            $content = $Matches[1].Trim()
            $targetType = if ($isUlistItem) { "ul" } else { "ol" }

            if ($inList -and $listType -ne $targetType) {
                $html.AppendLine("</$listType>")
                $inList = $false
            }

            if (-not $inList) {
                $inList = $true
                $listType = $targetType
                $html.AppendLine("<$listType>")
            }

            $parsedContent = Convert-InlineMarkdown $content
            $html.AppendLine("<li>$parsedContent</li>")
            continue
        } else {
            if ($inList) {
                $html.AppendLine("</$listType>")
                $inList = $false
            }
        }

        # Blank Line (paragraph separator)
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        # Normal Paragraph
        $parsedLine = Convert-InlineMarkdown $line
        $html.AppendLine("<p>$parsedLine</p>")
    }

        # Clean up blocks
        if ($inTable) { $html.AppendLine("</tbody>`n</table>") }
        if ($inList) { $html.AppendLine("</$listType>") }
        if ($inQuote) { $html.AppendLine("</blockquote>") }
    })

    return $html.ToString()
}

# 4 main folders to search
$TargetFolders = @(
    "content/understanding",
    "content/safety",
    "content/manufacturing",
    "content/law"
)

Write-Host "Starting Markdown to HTML Conversion..." -ForegroundColor Cyan

foreach ($FolderName in $TargetFolders) {
    $FolderPath = Join-Path $WorkspaceDir $FolderName
    if (-not (Test-Path $FolderPath)) {
        Write-Host "Warning: Directory $FolderName does not exist, skipping." -ForegroundColor Yellow
        continue
    }

    Write-Host "Processing folder: $FolderName" -ForegroundColor Magenta
    $MdFiles = Get-ChildItem -Path $FolderPath -Filter "*.md"
    
    foreach ($File in $MdFiles) {
        $InputPath = $File.FullName
        $OutputPath = [System.IO.Path]::ChangeExtension($InputPath, ".html")

        # Load content in UTF8 to preserve Korean
        $MdContent = [System.IO.File]::ReadAllText($InputPath, [System.Text.Encoding]::UTF8)
        
        # Get Title from first header if possible
        $Title = $File.BaseName
        if ($MdContent -match '^#\s+(.*)') {
            $Title = $Matches[1].Trim()
        }

        # Parse MD to HTML
        $BodyHtml = Convert-MarkdownToHtml $MdContent
        
        # Inject into template
        $FinalHtml = $HtmlTemplate.Replace("{{TITLE}}", $Title).Replace("{{CONTENT}}", $BodyHtml)

        # Write file with UTF8 encoding with BOM for proper browser/system compatibility
        [System.IO.File]::WriteAllText($OutputPath, $FinalHtml, [System.Text.Encoding]::UTF8)

        Write-Host "  Converted: $($File.Name) -> $(Split-Path $OutputPath -Leaf)" -ForegroundColor Green
    }
}

# Also convert study_summary.md in the root workspace
$SummaryMdPath = Join-Path $WorkspaceDir "docs\study_summary.md"
$SummaryHtmlPath = Join-Path $WorkspaceDir "docs\study_summary.html"
if (Test-Path $SummaryMdPath) {
    Write-Host "Processing root summary document: study_summary.md" -ForegroundColor Magenta
    $MdContent = [System.IO.File]::ReadAllText($SummaryMdPath, [System.Text.Encoding]::UTF8)
    
    $Title = "1~4과목 핵심 이론 요약본"
    if ($MdContent -match '^#\s+(.*)') {
        $Title = $Matches[1].Trim()
    }
    
    $BodyHtml = Convert-MarkdownToHtml $MdContent
    $FinalHtml = $HtmlTemplate.Replace("{{TITLE}}", $Title).Replace("{{CONTENT}}", $BodyHtml)
    
    [System.IO.File]::WriteAllText($SummaryHtmlPath, $FinalHtml, [System.Text.Encoding]::UTF8)
    Write-Host "  Converted root: study_summary.md -> study_summary.html" -ForegroundColor Green
}

# Also convert subject*.md (mock exams) in the root workspace
$SubjectFiles = Get-ChildItem -Path (Join-Path $WorkspaceDir "exams") -Filter "subject*.md"
foreach ($File in $SubjectFiles) {
    $MdPath = $File.FullName
    $HtmlPath = [System.IO.Path]::ChangeExtension($MdPath, ".html")
    
    Write-Host "Processing root exam document: $($File.Name)" -ForegroundColor Magenta
    $MdContent = [System.IO.File]::ReadAllText($MdPath, [System.Text.Encoding]::UTF8)
    
    # Get Title from first line
    $Title = $File.BaseName
    if ($MdContent -match '^#\s+(.*)') {
        $Title = $Matches[1].Trim()
    }
    
    $BodyHtml = Convert-MarkdownToHtml $MdContent
    $FinalHtml = $HtmlTemplate.Replace("{{TITLE}}", $Title).Replace("{{CONTENT}}", $BodyHtml)
    
    [System.IO.File]::WriteAllText($HtmlPath, $FinalHtml, [System.Text.Encoding]::UTF8)
    Write-Host "  Converted root: $($File.Name) -> $(Split-Path $HtmlPath -Leaf)" -ForegroundColor Green
}

Write-Host "Markdown to HTML Conversion Completed successfully!" -ForegroundColor Cyan
