# Overwrite the commit message file ($args[0]) with our message (no trailer).
$msgPath = $args[0]
$msg = @"
Viewer: blank lines without severity dot, optional line number, file-line sequencing

- Hide severity dot on blank lines; keep vertical severity bar for continuity.
- Use file line number (idx+1) for decoration counter when available so sequence never skips.
- Blank lines show no counter by default; add Decoration setting 'Show line number on blank lines' (off by default) so Go to Line matches file references.
- When option is on, counter on blank lines shows even if main Counter is off.
- CHANGELOG and README updated.
"@
Set-Content -Path $msgPath -Value $msg -NoNewline:$false
exit 0
