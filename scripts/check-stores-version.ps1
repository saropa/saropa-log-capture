# Query Open VSX and VS Marketplace APIs for saropa-log-capture (single source of truth for store checks).
#
# Report once (no polling):
#   .\check-stores-version.ps1 -ReportOnly [-ExpectedVersion "3.12.0"]
#
# Poll until deadline (propagation / smoke):
#   .\check-stores-version.ps1 -ExpectedVersion "3.12.0" [-IntervalSeconds 30] [-TotalMinutes 10]
#
param(
    [string]$ExpectedVersion = "",
    [switch]$ReportOnly,
    [int]$IntervalSeconds = 30,
    [int]$TotalMinutes = 10
)

$ErrorActionPreference = "Continue"
$bodyFile = Join-Path $PSScriptRoot "marketplace-gallery-query-body.json"
if (-not (Test-Path $bodyFile)) {
    Write-Error "Missing $bodyFile (JSON POST body for gallery API)."
    exit 1
}

$openvsxUrl = "https://open-vsx.org/api/saropa/saropa-log-capture"
$marketplaceUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.1-preview.1"

function Get-MarketplaceVersion {
    try {
        $raw = curl.exe -s -X POST $marketplaceUrl -H "Content-Type: application/json; charset=utf-8" --data-binary "@$bodyFile" 2>&1
        if ($LASTEXITCODE -ne 0) { return "curl:$LASTEXITCODE" }
        $d = $raw | ConvertFrom-Json
        if (-not $d.results) { return "bad-json" }
        return $d.results[0].extensions[0].versions[0].version
    }
    catch {
        return "err:$($_.Exception.Message)"
    }
}

function Get-OpenVsxVersion {
    try {
        $j = Invoke-RestMethod -Uri $openvsxUrl -Method Get
        return $j.version
    }
    catch {
        return "err:$($_.Exception.Message)"
    }
}

# ── Single report: print versions; optional compare to ExpectedVersion ─────────
if ($ReportOnly) {
    $ov = Get-OpenVsxVersion
    $mp = Get-MarketplaceVersion
    Write-Host "Open VSX:              $ov"
    Write-Host "VS Marketplace:        $mp"
    if ($ExpectedVersion -ne "") {
        Write-Host "package.json expected: $ExpectedVersion"
        $okOv = ($ov -eq $ExpectedVersion)
        $okMp = ($mp -eq $ExpectedVersion)
        if (-not $okOv) { Write-Host "Open VSX does not match expected version." }
        if (-not $okMp) { Write-Host "VS Marketplace does not match expected version." }
        if ($okOv -and $okMp) {
            Write-Host "Both stores match package.json version."
            exit 0
        }
        exit 1
    }
    exit 0
}

# ── Poll mode: ExpectedVersion from param or package.json ─────────────────────
if ($ExpectedVersion -eq "") {
    $pkgPath = Join-Path (Split-Path $PSScriptRoot -Parent) "package.json"
    try {
        $ExpectedVersion = (Get-Content -LiteralPath $pkgPath -Raw -Encoding utf8 | ConvertFrom-Json).version
    }
    catch {
        Write-Error "Poll mode: pass -ExpectedVersion or ensure package.json exists at $pkgPath"
        exit 1
    }
}

$iterations = [math]::Floor($TotalMinutes * 60 / $IntervalSeconds) + 1
$reportsDir = Join-Path (Split-Path $PSScriptRoot -Parent) "reports"
if (-not (Test-Path $reportsDir)) { New-Item -ItemType Directory -Path $reportsDir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $reportsDir "store_version_check_$stamp.log"

"store_version_check start Expected=$ExpectedVersion Interval=${IntervalSeconds}s TotalMinutes=$TotalMinutes Iterations=$iterations" | Tee-Object -FilePath $logPath -Append
"" | Tee-Object -FilePath $logPath -Append

for ($i = 1; $i -le $iterations; $i++) {
    $ts = Get-Date -Format "o"
    $ov = Get-OpenVsxVersion
    $mp = Get-MarketplaceVersion
    $okOv = ($ov -eq $ExpectedVersion)
    $okMp = ($mp -eq $ExpectedVersion)
    $line = "$ts  #$i/$iterations  OpenVSX=$ov $(if($okOv){'OK'}else{'MISMATCH'})  Marketplace=$mp $(if($okMp){'OK'}else{'MISMATCH'})"
    $line | Tee-Object -FilePath $logPath -Append
    if ($i -lt $iterations) {
        Start-Sleep -Seconds $IntervalSeconds
    }
}

"" | Tee-Object -FilePath $logPath -Append
"store_version_check done log=$logPath" | Tee-Object -FilePath $logPath -Append
Write-Host "Log: $logPath"
