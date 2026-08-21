$WorkspaceDir = Split-Path -Parent $PSScriptRoot
if (!$WorkspaceDir) { $WorkspaceDir = (Get-Location).Path }
$OutputFile = Join-Path $WorkspaceDir "data\exam_data.js"
$ExamsDir = Join-Path $WorkspaceDir "exams"

$AllFiles = Get-ChildItem -Path $ExamsDir -Filter "subject*.md"
$ExamFiles = @()

foreach ($File in $AllFiles) {
    if ($File.Name -match '^subject(\d+)_(?:part\d+|\d+)_.*\.md$' -or $File.Name -match '^subject(\d+)_100_questions\.md$') {
        $s = [int]$Matches[1]
        $p = 1
        
        if ($File.Name -match 'part(\d+)') {
            $p = [int]$Matches[1]
        } elseif ($File.Name -match '_p(\d+)') {
            $p = [int]$Matches[1]
        }
        
        $id = "subject$s"
        if ($s -ne 1) {
            $id += "_p$p"
        }
        
        $ExamFiles += @{
            Id = $id
            File = $File.Name
            SubjectNum = $s
            PartNum = $p
        }
    }
}

$ExamFiles = $ExamFiles | Sort-Object -Property SubjectNum, PartNum

$CompiledData = [ordered]@{}

foreach ($Exam in $ExamFiles) {
    $FilePath = Join-Path $ExamsDir $Exam.File
    if (-not (Test-Path $FilePath)) {
        continue
    }

    # Load content with UTF8 to ensure Korean is read correctly
    $Lines = Get-Content -Path $FilePath -Encoding UTF8
    
    # Get Title from first line
    $ExamTitle = "Exam"
    if ($Lines.Count -gt 0) {
        $FirstLine = $Lines[0].Trim()
        if ($FirstLine.StartsWith("#")) {
            $ExamTitle = $FirstLine.Substring(1).Trim()
        }
    }

    # Use standard hash tables to prevent indexer vs key lookup confusion in PowerShell
    $QuestionsMap = @{}
    $AnswersMap = @{}
    
    $CurrentQuestion = $null
    $IsParsingAnswers = $false
    
    # ASCII-only regex patterns to avoid encoding issues with the script file
    $QHeaderPattern = '^###\s+Q(\d+)[\.\s:]+(.*)'
    $OptionPattern = '^[\u2460-\u2464]\s*(.*)'
    $ExplanationPattern = '^\s*\*\s+\*[^\*]+\*[\s:]*(.*)'

    foreach ($Line in $Lines) {
        $L = $Line.Trim()
        
        # Trigger answers section if the line starts with answer bullet (* **Q1)
        if ($L -match '^\*\s+\*\*Q\d+') {
            $IsParsingAnswers = $true
        }

        if (-not $IsParsingAnswers) {
            # 1. Parse questions
            if ($L -match $QHeaderPattern) {
                $qNum = [int]$Matches[1]
                $qText = $Matches[2].Trim()
                
                # Determine type using ASCII/numeric ranges
                $type = 'blank'
                $isOxRange = (($qNum -ge 71 -and $qNum -le 100) -or ($qNum -ge 171 -and $qNum -le 200) -or ($qNum -ge 271 -and $qNum -le 300))
                if ($qText -like "*(O / X)*" -or $isOxRange) {
                    $type = 'ox'
                }

                $CurrentQuestion = @{
                    id = "$($Exam.Id)_q$qNum"
                    num = $qNum
                    type = $type
                    question = ($qText -replace '^\[[^\]]+\]\s*', '')
                    options = [System.Collections.ArrayList]@()
                    answer = ""
                    explanation = ""
                }
                $QuestionsMap[[string]$qNum] = $CurrentQuestion
                continue
            }

            if ($null -ne $CurrentQuestion) {
                if ($L -match $OptionPattern) {
                    [void]$CurrentQuestion.options.Add($Matches[1].Trim())
                    $CurrentQuestion.type = 'choice'
                } elseif ($L.Length -gt 0 -and $L -notlike "---" -and $L -notlike "##*" -and $L -notlike "*답안 작성란*") {
                    if (-not $CurrentQuestion.question.Contains($L)) {
                        $CurrentQuestion.question += "`n" + $L
                    }
                }
            }
        } else {
            # 2. Parse answers
            if ($L -match '^\*\s+\*\*Q(\d+)') {
                $qNum = [int]$Matches[1]
                $rawAns = ""
                
                # Split inside bold stars vs outside bold stars
                if ($L -match '\*\*([^*]+)\*\*[\s:]*(.*)') {
                    $boldText = $Matches[1].Trim()
                    $afterText = $Matches[2].Trim()
                    
                    # Matches non-digits followed by colon (e.g. "정답: ①" or "Answer: A")
                    if ($boldText -match '[^\d\.\s]+[:\uFF1A]\s*(.*)') {
                        $rawAns = $Matches[1].Trim()
                    } elseif ($afterText.Length -gt 0) {
                        $rawAns = $afterText
                    } else {
                        $rawAns = ($boldText -replace '^Q\d+[\.\s]*', '').Trim()
                    }
                }
                
                $rawAns = ($rawAns -replace '\*\*','' -replace '[:\uFF1A]','').Trim()
                
                $AnswersMap[[string]$qNum] = @{
                    answer = $rawAns
                    explanation = ""
                }
                $CurrentQuestion = $AnswersMap[[string]$qNum]
                continue
            }

            if ($null -ne $CurrentQuestion) {
                if ($L -match $ExplanationPattern) {
                    $CurrentQuestion.explanation = $Matches[1].Trim()
                } elseif ($L.StartsWith('*') -or $L.StartsWith('-') -or ($L.Length -gt 0 -and $L -notlike "*Q*" -and $L -notlike "##*" -and $L -notlike "---")) {
                    $cleanedLine = ($L -replace '^\*+\s*', '' -replace '^-+\s*', '' -replace '^\s*\*([^\*]+)\*[:\uFF1A]?\s*', '').Trim()
                    if ($CurrentQuestion.explanation) {
                        $CurrentQuestion.explanation += "`n" + $cleanedLine
                    } else {
                        $cleanedLine = $cleanedLine -replace '^\*해설\*[:\uFF1A]?\s*', ''
                        $CurrentQuestion.explanation = $cleanedLine
                    }
                }
            }
        }
    }

    $QuestionsList = @()
    foreach ($qNumKey in $QuestionsMap.Keys) {
        $q = $QuestionsMap[$qNumKey]
        $ansData = $AnswersMap[$qNumKey]
        if ($null -ne $ansData) {
            $q.answer = $ansData.answer
            $q.explanation = if ($ansData.explanation) { $ansData.explanation } else { "No explanation" }
        }
        
        if ($q.type -eq 'ox' -and $q.options.Count -eq 0) {
            [void]$q.options.Add('O')
            [void]$q.options.Add('X')
        }

        $q.options = $q.options.ToArray()
        $QuestionsList += $q
    }

    $CompiledData[$Exam.Id] = [ordered]@{
        id = $Exam.Id
        title = $ExamTitle
        questions = ($QuestionsList | Sort-Object -Property num)
    }
}

$JsonContent = ConvertTo-Json -InputObject $CompiledData -Depth 100
$OutputContent = "// Auto-generated Exam Database for Customized Cosmetics Exam`nconst EXAM_DATA = $JsonContent;`n"
Set-Content -Path $OutputFile -Value $OutputContent -Encoding UTF8
