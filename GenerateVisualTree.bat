<# :
@echo off
chcp 65001 >nul
echo Building visual project map with emojis...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Encoding UTF8 -Raw; $s = $s -replace '(?s)^.*?#[>]', ''; Invoke-Expression $s"
echo.
echo Success! Your project map is saved in "project_structure.txt"
echo.
pause
exit /b
#>

# --- POWERSHELL LOGIC STARTS HERE ---
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$rootItem = Get-Item .
$rootName = $rootItem.Name
$rootPath = $rootItem.FullName
$outputFile = "project_structure.txt"

# Fallback filters for heavy system folders
$excludePatterns = "^(\.git|node_modules|__pycache__|\.venv|venv|exports|project_structure\.txt)$"

# --- Parse .gitignore ---
$gitIgnorePatterns = @()
if (Test-Path ".gitignore") {
    Get-Content ".gitignore" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and $line[0] -ne '#') {
            $isDir = $line.EndsWith('/')
            if ($isDir) { $line = $line.TrimEnd('/') }
            
            $regex = [regex]::Escape($line)
            $regex = $regex -replace '\\\*', '.*'
            $regex = $regex -replace '\\\?', '.'
            
            if ($regex.StartsWith('/')) { $regex = "^" + $regex.Substring(1) } else { $regex = "(^|/)" + $regex }
            
            $gitIgnorePatterns += @{ Regex = $regex + "$"; IsDir = $isDir }
        }
    }
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("$rootName/")
$lines.Add("│")

function Build-Tree {
    param([string]$Path, [string]$Prefix, [int]$Depth)
    
    $items = @(Get-ChildItem -Path $Path -Force | Where-Object { $_.Name -notmatch $excludePatterns })
    $items = $items | Sort-Object @{Expression={$_.PSIsContainer};Descending=$true}, Name
    $total = $items.Count
    $count = 0
    
    foreach ($item in $items) {
        # Check against .gitignore rules
        $relPath = $item.FullName.Substring($rootPath.Length).TrimStart('\', '/').Replace('\', '/')
        $ignored = $false
        foreach ($p in $gitIgnorePatterns) {
            if ($p.IsDir -and -not $item.PSIsContainer) { continue }
            if ($relPath -match $p.Regex -or $item.Name -match $p.Regex) {
                $ignored = $true; break
            }
        }
        if ($ignored) { continue }

        $count++
        $isLast = ($count -eq $total)
        $connector = if ($isLast) { "└── " } else { "├── " }
        $childPrefix = if ($isLast) { $Prefix + "    " } else { $Prefix + "│   " }
        
        if ($item.PSIsContainer) {
            $emoji = if ($Depth -eq 0) { "📂" } else { "📁" }
            $lines.Add("$Prefix$connector$emoji $($item.Name)/")
            Build-Tree -Path $item.FullName -Prefix $childPrefix -Depth ($Depth + 1)
        } else {
            $ext = $item.Extension.ToLower()
            $emoji = switch ($ext) {
                ".html" { "🌐" } ".css"  { "🎨" } ".js"   { "📜" } ".py"   { "🐍" }
                ".pyc"  { "🐍" } ".txt"  { "📝" } ".md"   { "📖" } ".json" { "⚙️" }
                ".bat"  { "💻" } ".sh"   { "💻" }
                default { 
                    if ($item.Name -match "^(\.env|\.gitignore|requirements\.txt)$") { "⚙️" } else { "📄" }
                }
            }
            $lines.Add("$Prefix$connector$emoji $($item.Name)")
        }
    }
}

Build-Tree -Path . -Prefix "" -Depth 0
[System.IO.File]::WriteAllLines("$PWD\$outputFile", $lines, (New-Object System.Text.UTF8Encoding($true)))
