$WorkspaceDir = Split-Path -Parent $PSScriptRoot
if (!$WorkspaceDir) { $WorkspaceDir = (Get-Location).Path }
$OutputFile = Join-Path $WorkspaceDir "data\study_data.js"

$SubjectDirs = @(
    [PSCustomObject]@{ Id = "law"; Name = "1과목: 화장품법의 이해"; Dir = "content/law" },
    [PSCustomObject]@{ Id = "manufacturing"; Name = "2과목: 화장품 제조 및 품질관리"; Dir = "content/manufacturing" },
    [PSCustomObject]@{ Id = "safety"; Name = "3과목: 유통화장품 안전관리"; Dir = "content/safety" },
    [PSCustomObject]@{ Id = "understanding"; Name = "4과목: 맞춤형화장품의 이해"; Dir = "content/understanding" }
)

$ResultData = @{}

# 정규식 정의 (수치 감지 패턴 강화)
$NumericPattern = '\b\d+(?:\.\d+)?(?:%|세 이하|세 이상|개월|일|년|배|종|가지|개|시간|g|ml|kg|℃|도|분|초|주|ppm|㎛|회/hr|개/hr|개/㎥)\b'

function Clear-Text($text) {
    if (!$text) { return "" }
    $t = $text -replace '<br\s*/?>', "`n"
    $t = $t -replace '&nbsp;', " "
    $t = $t -replace '🔖기출|📌중요|`\[기출\]`|\[기출\]|`\[중요\]`|\[중요\]', ""
    return $t.Trim()
}

function ConvertTo-RegExp($string) {
    return [Regex]::Escape($string)
}

# 루프 내부로 Invoke-ProcessTableRows 함수 추출 (PSScriptAnalyzer 경고 해결)
function Invoke-ProcessTableRows($headers, $rows, $subjId, $section, $cardsList, $quizzesList, $filePrefix) {
    if ($rows.Count -eq 0) { return }
    $termIdx = 0
    $descIdx = 0
    if ($headers.Count -gt 1) { $descIdx = 1 }

    foreach ($Row in $rows) {
        if ($Row.Count -lt 2) { continue }
        $RawTerm = $Row[$termIdx]
        $RawDesc = $Row[$descIdx]

        $Term = Clear-Text $RawTerm
        $Desc = Clear-Text $RawDesc

        if (!$Term -or !$Desc) { continue }

        $IsKey = ($RawTerm + $RawDesc) -match '🔖기출|📌중요|\[기출\]|\[중요\]'

        $CardId = $subjId + "_card_" + $filePrefix + "_" + ($cardsList.Count + 1)
        $card = [PSCustomObject]@{
            id = $CardId;
            category = $section;
            term = ($Term -replace '\*\*([^*]+)\*\*','$1');
            definition = $Desc;
            isKey = [bool]$IsKey;
        }
        [void]$cardsList.Add($card)

        # 기출이 아니더라도 수치나 굵은 글씨가 있으면 퀴즈 대상으로 삼음
        $BoldMatches = [regex]::Matches($RawDesc, '\*\*([^*]+)\*\*')
        $NumMatches = [regex]::Matches($RawDesc, $NumericPattern)

        if ($BoldMatches.Count -gt 0) {
            foreach ($Match in $BoldMatches) {
                $Answer = $Match.Groups[1].Value.Trim()
                if ($Answer.Length -gt 1 -and $Answer -notlike "*기출*" -and $Answer -notlike "*중요*") {
                    $EscapedAnswer = ConvertTo-RegExp $Answer
                    $QuizText = ($Desc -replace "\*\*$EscapedAnswer\*\*|$EscapedAnswer", " [ 빈칸 ] ")
                    
                    if (($QuizText -replace '\s+', '') -eq '[빈칸]') { continue }

                    $QuizId = $subjId + "_quiz_" + $filePrefix + "_" + ($quizzesList.Count + 1)
                    [void]$quizzesList.Add([PSCustomObject]@{
                        id = $QuizId;
                        category = $section;
                        context = "[용어: $Term]";
                        question = $QuizText;
                        answer = $Answer;
                        type = "blank";
                    })
                }
            }
        } elseif ($NumMatches.Count -gt 0) {
            foreach ($Match in $NumMatches) {
                $Answer = $Match.Value.Trim()
                $EscapedAnswer = ConvertTo-RegExp $Answer
                $QuizText = ($Desc -replace $EscapedAnswer, " [ 빈칸 ] ")
                
                if (($QuizText -replace '\s+', '') -eq '[빈칸]') { continue }

                $QuizId = $subjId + "_quiz_" + $filePrefix + "_" + ($quizzesList.Count + 1)
                [void]$quizzesList.Add([PSCustomObject]@{
                    id = $QuizId;
                    category = $section;
                    context = "[용어: $Term]";
                    question = $QuizText;
                    answer = $Answer;
                    type = "blank";
                })
            }
        } elseif ($IsKey) {
            $QuizId = $subjId + "_quiz_" + $filePrefix + "_" + ($quizzesList.Count + 1)
            [void]$quizzesList.Add([PSCustomObject]@{
                id = $QuizId;
                category = $section;
                context = "정의에 알맞은 용어를 적으시오.";
                question = $Desc;
                answer = ($Term -replace '\*\*', '');
                type = "term";
            })
        }
    }
}

foreach ($Subj in $SubjectDirs) {
    $SubjPath = Join-Path $WorkspaceDir $Subj.Dir
    if (-not (Test-Path $SubjPath)) {
        Write-Host "Warning: $SubjPath does not exist"
        continue
    }

    # ArrayList 사용
    $Cards = New-Object System.Collections.ArrayList
    $Quizzes = New-Object System.Collections.ArrayList
    $Chapters = New-Object System.Collections.ArrayList

    $Files = Get-ChildItem -Path $SubjPath -Filter "*.md" | Sort-Object Name
    foreach ($File in $Files) {
        $Content = [System.IO.File]::ReadAllText($File.FullName, [System.Text.Encoding]::UTF8)
        $Lines = $Content -split "\r?\n"

        $CurrentSection = $File.BaseName
        $FilePrefix = "0"
        if ($File.BaseName -match '^(\d+)\.') {
            $FilePrefix = $Matches[1]
        }
        $InTable = $false
        $TableHeaders = @()
        $TableRows = New-Object System.Collections.ArrayList

        for ($i = 0; $i -lt $Lines.Length; $i++) {
            $Line = $Lines[$i].Trim()

            if ($Line.StartsWith("## ")) {
                $CurrentSection = $Line.Substring(3).Trim()
                continue
            }

            if ($Line.StartsWith("|")) {
                if (-not $InTable) {
                    $InTable = $true
                    $TableHeaders = ($Line -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
                    $TableRows.Clear()
                    if ($i + 1 -lt $Lines.Length -and $Lines[$i + 1].Trim().Contains("---")) {
                        $i++
                    }
                } else {
                    $RowCells = ($Line -split '\|' | ForEach-Object { $_.Trim() })
                    if ($RowCells.Count -gt 2) {
                        $RowCells = $RowCells[1..($RowCells.Count - 2)]
                        [void]$TableRows.Add($RowCells)
                    }
                }
            } else {
                if ($InTable) {
                    Invoke-ProcessTableRows $TableHeaders $TableRows $Subj.Id $CurrentSection $Cards $Quizzes $FilePrefix
                    $InTable = $false
                }

                $CleanedLine = Clear-Text $Line
                $HasNumber = $CleanedLine -match $NumericPattern
                $HasBold = $Line -match '\*\*([^*]+)\*\*'
                $IsListItem = $Line -match '^[-*]\s+\*\*([^*]+)\*\*'

                if ($Line.Contains("🔖기출") -or $Line.Contains("📌중요") -or $Line.Contains("[기출]") -or $Line.Contains("[중요]") -or $HasNumber -or $HasBold) {
                    
                    if ($IsListItem -and $Line -match '^[-*]\s+\*\*([^*]+)\*\*(?:\s*(?:🔖기출|📌중요|\[기출\]|\[중요\]))?\s*[:：]\s*(.+)$') {
                        $Term = $Matches[1].Trim()
                        $Desc = $Matches[2].Trim()

                        $CardId = $Subj.Id + "_card_" + $FilePrefix + "_" + ($Cards.Count + 1)
                        [void]$Cards.Add([PSCustomObject]@{
                            id = $CardId;
                            category = $CurrentSection;
                            term = $Term;
                            definition = Clear-Text $Desc;
                            isKey = $true;
                        })

                        $BoldMatches = [regex]::Matches($Desc, '\*\*([^*]+)\*\*')
                        if ($BoldMatches.Count -gt 0) {
                            foreach ($M in $BoldMatches) {
                                $Ans = $M.Groups[1].Value.Trim()
                                $EscapedAns = ConvertTo-RegExp $Ans
                                $QuizText = ((Clear-Text $Desc) -replace "\*\*$EscapedAns\*\*|$EscapedAns", " [ 빈칸 ] ")
                                
                                if (($QuizText -replace '\s+', '') -eq '[빈칸]') { continue }

                                $QuizId = $Subj.Id + "_quiz_" + $FilePrefix + "_" + ($Quizzes.Count + 1)
                                [void]$Quizzes.Add([PSCustomObject]@{
                                    id = $QuizId;
                                    category = $CurrentSection;
                                    context = "[주제: $Term]";
                                    question = $QuizText;
                                    answer = $Ans;
                                    type = "blank";
                                })
                            }
                        }
                    } elseif ($Line.Length -gt 15 -and -not $Line.StartsWith("#") -and -not $Line.StartsWith("|") -and -not $Line.StartsWith(">")) {
                        $NumMatches = [regex]::Matches($CleanedLine, $NumericPattern)
                        $BoldMatches = [regex]::Matches($Line, '\*\*([^*]+)\*\*')

                        if ($BoldMatches.Count -gt 0) {
                            foreach ($M in $BoldMatches) {
                                $Ans = $M.Groups[1].Value.Trim()
                                if ($Ans.Length -gt 1 -and $Ans -notlike "*기출*" -and $Ans -notlike "*중요*" -and $Ans.Length -lt 25) {
                                    $EscapedAns = ConvertTo-RegExp $Ans
                                    $QuizText = $CleanedLine -replace "\*\*$EscapedAns\*\*|$EscapedAns", " [ 빈칸 ] "
                                    
                                    if (($QuizText -replace '\s+', '') -eq '[빈칸]') { continue }

                                    $QuizId = $Subj.Id + "_quiz_" + $FilePrefix + "_" + ($Quizzes.Count + 1)
                                    [void]$Quizzes.Add([PSCustomObject]@{
                                        id = $QuizId;
                                        category = $CurrentSection;
                                        context = "[본문 빈칸 채우기]";
                                        question = $QuizText;
                                        answer = $Ans;
                                        type = "blank";
                                    })
                                }
                            }
                        } elseif ($NumMatches.Count -gt 0) {
                            foreach ($M in $NumMatches) {
                                $Ans = $M.Value.Trim()
                                $EscapedAns = ConvertTo-RegExp $Ans
                                $QuizText = ($CleanedLine -replace $EscapedAns, " [ 빈칸 ] ")
                                
                                if (($QuizText -replace '\s+', '') -eq '[빈칸]') { continue }

                                $QuizId = $Subj.Id + "_quiz_" + $FilePrefix + "_" + ($Quizzes.Count + 1)
                                [void]$Quizzes.Add([PSCustomObject]@{
                                    id = $QuizId;
                                    category = $CurrentSection;
                                    context = "[본문 빈칸 채우기]";
                                    question = $QuizText;
                                    answer = $Ans;
                                    type = "blank";
                                })
                            }
                        }
                    }
                }
            }
        }

        if ($InTable) {
            Invoke-ProcessTableRows $TableHeaders $TableRows $Subj.Id $CurrentSection $Cards $Quizzes $FilePrefix
        }

        # 교재 본문 추출 추가
        $ChapterTitle = $File.BaseName
        $Sections = New-Object System.Collections.ArrayList
        $CurrentSectionTitle = "개요"
        $CurrentSectionLines = New-Object System.Collections.ArrayList

        for ($j = 0; $j -lt $Lines.Length; $j++) {
            $LineText = $Lines[$j]
            $TrimmedLine = $LineText.Trim()

            if ($TrimmedLine.StartsWith("# ")) {
                $ChapterTitle = $TrimmedLine.Substring(2).Trim()
                continue
            }

            if ($TrimmedLine.StartsWith("## ")) {
                if ($CurrentSectionLines.Count -gt 0) {
                    $SectionContent = $CurrentSectionLines -join "`n"
                    [void]$Sections.Add([PSCustomObject]@{
                        title = $CurrentSectionTitle;
                        content = $SectionContent.Trim();
                    })
                }
                $CurrentSectionTitle = $TrimmedLine.Substring(3).Trim()
                $CurrentSectionLines.Clear()
                continue
            }

            [void]$CurrentSectionLines.Add($LineText)
        }

        if ($CurrentSectionLines.Count -gt 0) {
            $SectionContent = $CurrentSectionLines -join "`n"
            [void]$Sections.Add([PSCustomObject]@{
                title = $CurrentSectionTitle;
                content = $SectionContent.Trim();
            })
        }

        $HtmlFilename = $File.Name -replace '\.md$', '.html'
        $FilePathUrl = "./" + $Subj.Dir + "/" + $HtmlFilename

        [void]$Chapters.Add([PSCustomObject]@{
            chapterTitle = $ChapterTitle;
            fileName = $File.Name;
            filePath = $FilePathUrl;
            sections = $Sections;
        })
    }

    # 중복 제거
    $UniqueQuizzes = New-Object System.Collections.ArrayList
    $QuizKeys = @{}
    foreach ($Q in $Quizzes) {
        $Key = $Q.question + "_" + $Q.answer
        if (-not $QuizKeys.ContainsKey($Key)) {
            $QuizKeys[$Key] = $true
            [void]$UniqueQuizzes.Add($Q)
        }
    }

    $ResultData[$Subj.Id] = @{
        name = $Subj.Name;
        cards = $Cards;
        quizzes = $UniqueQuizzes;
        chapters = $Chapters;
    }

    Write-Host "- $($Subj.Name): 카드 $($Cards.Count)개, 퀴즈 $($UniqueQuizzes.Count)개, 단원 $($Chapters.Count)개 추출 완료."
}

$JsonData = ConvertTo-Json -InputObject $ResultData -Depth 10
$OutputContent = "// 자동 생성된 학습 데이터 파일입니다. 수정하지 마십시오.`nconst STUDY_DATA = $JsonData;`n"
[System.IO.File]::WriteAllText($OutputFile, $OutputContent, [System.Text.Encoding]::UTF8)
Write-Host "파싱 완료! 결과가 $OutputFile 에 저장되었습니다."

# 원료 데이터 파싱 자동 연동
$IngredientsScript = Join-Path $PSScriptRoot "parse_ingredients.ps1"
if (Test-Path $IngredientsScript) {
    & $IngredientsScript
}
