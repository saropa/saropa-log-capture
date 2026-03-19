# Overwrite the path given by Git with our clean message (no editor trailers).
$msgPath = $args[0]
$cleanPath = Join-Path $PSScriptRoot 'commit-msg-clean.txt'
Get-Content -Raw $cleanPath | Set-Content -Path $msgPath -NoNewline
if ($LASTEXITCODE) { exit $LASTEXITCODE }
