# 049: Mid-line stack frame detection

## Problem

`isStackFrameText()` (viewer-script.ts:139-153) and `isStackFrameLine()`
(stack-parser.ts:145-157) only detect stack frames when the recognizable
pattern appears at the **start** of the line. Lines prefixed with `⠀ »` or
other decorations fail all existing checks even though they contain obvious
Dart source paths mid-line:

```
⠀ » _InterceptedExecutor.runSelect package:drift/src/runtime/executor/interceptor.dart:163:25
⠀ » DriftDebugInterceptor._log (./lib/database/drift/drift_debug_interceptor.dart:92:5)
```

The patterns `package:*.dart:line:col` and `(./lib/*.dart:line:col)` are
unambiguous stack frame indicators regardless of what precedes them.

## Proposal

Add a mid-line check to both `isStackFrameText()` and `isStackFrameLine()`
that matches Dart source paths anywhere in the line:

```
/\bpackage:\S+\.dart:\d+/
/\(\.\/\S+\.dart:\d+:\d+\)/
```

These patterns are specific enough to avoid false positives on normal log text.

## Scope

- `src/ui/viewer/viewer-script.ts` — `isStackFrameText()` (webview JS)
- `src/modules/analysis/stack-parser.ts` — `isStackFrameLine()` (TS mirror)
- Tests for both functions

## Risk

Low. The patterns are highly specific (requires `package:` + `.dart:` + digits,
or parenthesized relative path + `.dart:` + digits). False positives on normal
log lines are unlikely.
