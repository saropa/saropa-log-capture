# Overwrite the commit message file (first argument) with a clean message. No trailing newline beyond the body.
$msgPath = $args[0]
$msg = @"
fix(viewer): prevent context menu submenu from being cropped at top

When the right-click menu opens near the top of the view (e.g. under
a toolbar), apply flip-submenu-vertical-top and --submenu-content-top
so the Copy & Export (and other) submenu flyout stays below a safe
viewport margin. CSS order ensures near-bottom flip still wins when
both apply. Add unit test for near-top behavior.
"@
Set-Content -Path $msgPath -Value $msg -NoNewline
exit 0
