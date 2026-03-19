# Overwrite the commit message file (first argument from Git) with clean message. No trailers.
$msgPath = $args[0]
$cleanPath = Join-Path $PSScriptRoot 'commit-msg-clean.txt'
Get-Content -Raw -Path $cleanPath | Set-Content -Path $msgPath -NoNewline
exit 0
