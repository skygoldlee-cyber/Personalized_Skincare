$WorkspaceDir = Split-Path -Parent $PSScriptRoot
if (!$WorkspaceDir) { $WorkspaceDir = (Get-Location).Path }
$OutputFile = Join-Path $WorkspaceDir "data\ingredients_data.js"
$IngredientsDir = Join-Path $WorkspaceDir "ingredients"

# Assembled unicode strings using array join to prevent encoding errors and editor warnings
$H_Wonryomyung = [char]50896, [char]47308, [char]47749 -join ""
$H_Wonryumyung = [char]50896, [char]47308, [char]47749 -join ""
$H_Sungbunmyung = [char]49457, [char]48516, [char]47749 -join ""
$H_Youngmunmyung = [char]50689, [char]47928, [char]47749 -join ""
$H_Category = [char]52852, [char]53568, [char]44256, [char]47532 -join ""
$H_Teuksung = [char]53945, [char]49457, [char]32, [char]48143, [char]32, [char]49444, [char]47749 -join ""
$H_Teuk = [char]53945, [char]49457 -join ""
$H_Choedae = [char]52572, [char]45824, [char]32, [char]54632, [char]46979 -join ""
$H_Sahyong = [char]49324, [char]50857, [char]54620, [char]46020 -join ""
$H_SahyongHalTtae = [char]49324, [char]50857, [char]54624, [char]32, [char]46412, [char]32, [char]45453, [char]46020, [char]49345, [char]54620, [char]40, [char]37, [char]41 -join ""
$H_Nongdo = [char]45453, [char]46020, [char]49345, [char]54620 -join ""
$H_Godeuk = [char]44256, [char]46301, [char]51216, [char]32, [char]84, [char]73, [char]80 -join ""
$H_Bigo = [char]48708, [char]44256 -join ""
$H_Jeungsang = [char]51613, [char]49345, [char]32, [char]54952, [char]44284 -join ""
$H_Sulmyung = [char]49444, [char]47749 -join ""
$H_Yeoe = [char]50696, [char]50808, [char]32, [char]51312, [char]44148 -join ""

$V_RestrictedCategory = [char]49324, [char]50857, [char]32, [char]51228, [char]54620, [char]32, [char]50896, [char]47308 -join ""
$V_RestrictedDesc = [char]49324, [char]50857, [char]32, [char]51228, [char]54620, [char]32, [char]54596, [char]50836, [char]54620, [char]32, [char]50896, [char]47308 -join ""
$V_BannedCategory = [char]49324, [char]50857, [char]32, [char]44552, [char]51648, [char]32, [char]50896, [char]47308 -join ""
$V_BannedDesc = [char]48176, [char]54633, [char]32, [char]44552, [char]51648, [char]32, [char]49457, [char]48516 -join ""
$V_BannedLimit = [char]49324, [char]50857, [char]32, [char]48520, [char]44032, [char]32, [char]40, [char]48, [char]37, [char]41 -join ""
$V_BannedTip = [char]54868, [char]51109, [char]54408, [char]32, [char]51228, [char]51312, [char]47, [char]51312, [char]51228, [char]50640, [char]32, [char]49324, [char]50857, [char]51060, [char]32, [char]44552, [char]51648, [char]46104, [char]45716, [char]32, [char]50896, [char]47308, [char]51077, [char]45768, [char]45796, [char]46 -join ""

function Clear-Text {
    param([string]$text)
    if (!$text) { return "" }
    $t = $text -replace '\*\*', ""
    $t = $t -replace '`', ""
    $t = $t -replace '<br\s*/?>', " "
    return $t.Trim()
}

function Import-MarkdownTables {
    param([string]$filePath)
    if (-not (Test-Path $filePath)) { return @() }
    
    $Lines = Get-Content -Path $filePath -Encoding UTF8
    $Results = @()
    $CurrentSection = "General"
    $InTable = $false
    $Headers = @()
    
    foreach ($Line in $Lines) {
        $L = $Line.Trim()
        
        if ($L.StartsWith("### ")) {
            $CurrentSection = $L.Substring(4).Trim()
            $InTable = $false
            continue
        } elseif ($L.StartsWith("## ")) {
            $CurrentSection = $L.Substring(3).Trim()
            $InTable = $false
            continue
        }
        
        if ($L.StartsWith("|")) {
            if ($L.Contains("---")) {
                continue;
            }
            
            # Split and filter empty elements
            $Cells = $L.Split('|') | ForEach-Object { $_.Trim() }
            # Remove the first and last elements since MD tables start and end with '|'
            if ($Cells.Count -lt 3) { continue }
            $Cells = $Cells[1..($Cells.Count-2)]
            
            if (-not $InTable) {
                $Headers = @()
                foreach ($Cell in $Cells) {
                    $Headers += Clear-Text $Cell
                }
                $InTable = $true
            } else {
                $RowObj = [PSCustomObject]@{
                    Section = $CurrentSection
                    Headers = $Headers
                    Cells = $Cells
                }
                $Results += $RowObj
            }
        } else {
            $InTable = $false
        }
    }
    return $Results
}

$FinalList = @()

# 1. Approved Ingredients
$ApprovedPath = Join-Path $IngredientsDir "approved_ingredients.md"
if (Test-Path $ApprovedPath) {
    $Parsed = Import-MarkdownTables $ApprovedPath
    foreach ($Item in $Parsed) {
        $NameIdx = $Item.Headers.IndexOf($H_Wonryomyung)
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Wonryumyung) }
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Sungbunmyung) }
        $EngIdx = $Item.Headers.IndexOf($H_Youngmunmyung)
        $CatIdx = $Item.Headers.IndexOf($H_Category)
        $DescIdx = $Item.Headers.IndexOf($H_Teuksung)
        if ($DescIdx -eq -1) { $DescIdx = $Item.Headers.IndexOf($H_Teuk) }
        $LimitIdx = $Item.Headers.IndexOf($H_Choedae)
        if ($LimitIdx -eq -1) { $LimitIdx = $Item.Headers.IndexOf($H_Sahyong) }
        $TipIdx = $Item.Headers.IndexOf($H_Godeuk)
        if ($TipIdx -eq -1) { $TipIdx = $Item.Headers.IndexOf($H_Bigo) }
        
        if ($NameIdx -ne -1 -and $Item.Cells[$NameIdx]) {
            $Name = Clear-Text $Item.Cells[$NameIdx]
            if ($Name -and $Name -ne $H_Wonryomyung -and $Name -ne $H_Wonryumyung -and $Name -ne $H_Sungbunmyung) {
                $Obj = [ordered]@{
                    name = $Name
                    engName = if ($EngIdx -ne -1) { Clear-Text $Item.Cells[$EngIdx] } else { "" }
                    type = "approved"
                    category = if ($CatIdx -ne -1) { Clear-Text $Item.Cells[$CatIdx] } else { $Item.Section }
                    description = if ($DescIdx -ne -1) { Clear-Text $Item.Cells[$DescIdx] } else { "" }
                    limit = if ($LimitIdx -ne -1) { Clear-Text $Item.Cells[$LimitIdx] } else { "" }
                    tip = if ($TipIdx -ne -1) { Clear-Text $Item.Cells[$TipIdx] } else { "" }
                }
                $FinalList += [PSCustomObject]$Obj
            }
        }
    }
}

# 2. Restricted Ingredients
$RestrictedPath = Join-Path $IngredientsDir "restricted_ingredients.md"
if (Test-Path $RestrictedPath) {
    $Parsed = Import-MarkdownTables $RestrictedPath
    foreach ($Item in $Parsed) {
        $NameIdx = $Item.Headers.IndexOf($H_Wonryomyung)
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Wonryumyung) }
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Sungbunmyung) }
        $EngIdx = $Item.Headers.IndexOf($H_Youngmunmyung)
        $CatIdx = $Item.Headers.IndexOf($H_Category)
        $LimitIdx = $Item.Headers.IndexOf($H_Sahyong)
        if ($LimitIdx -eq -1) { $LimitIdx = $Item.Headers.IndexOf($H_SahyongHalTtae) }
        if ($LimitIdx -eq -1) { $LimitIdx = $Item.Headers.IndexOf($H_Nongdo) }
        $TipIdx = $Item.Headers.IndexOf($H_Godeuk)
        if ($TipIdx -eq -1) { $TipIdx = $Item.Headers.IndexOf($H_Bigo) }
        $DescIdx = $Item.Headers.IndexOf($H_Teuksung)
        if ($DescIdx -eq -1) { $DescIdx = $Item.Headers.IndexOf($H_Teuk) }
        
        if ($NameIdx -ne -1 -and $Item.Cells[$NameIdx]) {
            $Name = Clear-Text $Item.Cells[$NameIdx]
            if ($Name -and $Name -ne $H_Wonryomyung -and $Name -ne $H_Wonryumyung -and $Name -ne $H_Sungbunmyung) {
                # Check for existing
                $ExistingIdx = -1
                for ($k = 0; $k -lt $FinalList.Count; $k++) {
                    if ($FinalList[$k].name -eq $Name) {
                        $ExistingIdx = $k
                        break
                    }
                }
                
                $Obj = [ordered]@{
                    name = $Name
                    engName = if ($EngIdx -ne -1) { Clear-Text $Item.Cells[$EngIdx] } else { "" }
                    type = "restricted"
                    category = if ($CatIdx -ne -1) { Clear-Text $Item.Cells[$CatIdx] } else { $V_RestrictedCategory }
                    description = if ($DescIdx -ne -1) { Clear-Text $Item.Cells[$DescIdx] } else { $V_RestrictedDesc }
                    limit = if ($LimitIdx -ne -1) { Clear-Text $Item.Cells[$LimitIdx] } else { "" }
                    tip = if ($TipIdx -ne -1) { Clear-Text $Item.Cells[$TipIdx] } else { "" }
                }
                
                if ($ExistingIdx -ne -1) {
                    $FinalList[$ExistingIdx] = [PSCustomObject]$Obj
                } else {
                    $FinalList += [PSCustomObject]$Obj
                }
            }
        }
    }
}

# 3. Banned Ingredients
$BannedPath = Join-Path $IngredientsDir "banned_ingredients.md"
if (Test-Path $BannedPath) {
    $Parsed = Import-MarkdownTables $BannedPath
    foreach ($Item in $Parsed) {
        $NameIdx = $Item.Headers.IndexOf($H_Sungbunmyung)
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Wonryomyung) }
        if ($NameIdx -eq -1) { $NameIdx = $Item.Headers.IndexOf($H_Wonryumyung) }
        $EngIdx = $Item.Headers.IndexOf($H_Youngmunmyung)
        $DescIdx = $Item.Headers.IndexOf($H_Jeungsang)
        if ($DescIdx -eq -1) { $DescIdx = $Item.Headers.IndexOf($H_Sulmyung) }
        $TipIdx = $Item.Headers.IndexOf($H_Bigo)
        if ($TipIdx -eq -1) { $TipIdx = $Item.Headers.IndexOf($H_Yeoe) }
        
        if ($NameIdx -ne -1 -and $Item.Cells[$NameIdx]) {
            $Name = Clear-Text $Item.Cells[$NameIdx]
            if ($Name -and $Name -ne $H_Wonryomyung -and $Name -ne $H_Wonryumyung -and $Name -ne $H_Sungbunmyung) {
                $ExistingIdx = -1
                for ($k = 0; $k -lt $FinalList.Count; $k++) {
                    if ($FinalList[$k].name -eq $Name) {
                        $ExistingIdx = $k
                        break
                    }
                }
                
                $Obj = [ordered]@{
                    name = $Name
                    engName = if ($EngIdx -ne -1) { Clear-Text $Item.Cells[$EngIdx] } else { "" }
                    type = "banned"
                    category = $V_BannedCategory
                    description = if ($DescIdx -ne -1) { Clear-Text $Item.Cells[$DescIdx] } else { $V_BannedDesc }
                    limit = $V_BannedLimit
                    tip = if ($TipIdx -ne -1) { Clear-Text $Item.Cells[$TipIdx] } else { $V_BannedTip }
                }
                
                if ($ExistingIdx -ne -1) {
                    $FinalList[$ExistingIdx] = [PSCustomObject]$Obj
                } else {
                    $FinalList += [PSCustomObject]$Obj
                }
            }
        }
    }
}

# Convert to JSON
$Json = ConvertTo-Json $FinalList -Depth 5 -Compress
$OutputContent = "// 자동 생성된 화장품 원료 데이터 파일입니다. 수정하지 마십시오.`nconst INGREDIENTS_DATA = $Json;`n"

# Output UTF8 with BOM to avoid Korean broken characters in PowerShell on Windows
[System.IO.File]::WriteAllText($OutputFile, $OutputContent, [System.Text.Encoding]::UTF8)
Write-Host "Ingredients parsed! Output saved to $OutputFile. Total count: $($FinalList.Count)"