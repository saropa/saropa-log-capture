# File Scope radios all disabled once the log viewer has focus

## Symptom

Open the log viewer. Click **Filters → File Scope**. Only **All logs** is
selectable; **Only workspace / Only package / Only directory / Only file** are
all greyed out, regardless of whether a source file is open in the editor.

## Root cause

`setupScopeContextListener` in [src/activation-listeners.ts](../src/activation-listeners.ts)
subscribes to `vscode.window.onDidChangeActiveTextEditor` and unconditionally
rebuilds the scope context from `vscode.window.activeTextEditor`.

VS Code fires `onDidChangeActiveTextEditor` with `undefined` every time focus
moves to a non-text surface — the sidebar, the settings UI, **and webview
panels**, which includes the log viewer itself. When that happens
[buildScopeContext](../src/modules/storage/scope-context.ts) returns all-nulls,
the broadcaster posts a `setScopeContext` message with every path null, and
[updateScopeRadioDisabled](../src/ui/viewer-search-filter/viewer-scope-filter.ts)
flips every non-`all` radio to `disabled`.

So the instant the user clicks on the log viewer to open the Filters panel —
which is the exact moment they need those radios usable — the context that
enables them gets wiped.

## Fix

Ignore `undefined` firings of `onDidChangeActiveTextEditor`. Preserve the last
known scope context while focus is on a non-text surface. A subsequent focus
into another text editor will refresh the context naturally.

The initial seed on activation still passes `activeTextEditor` through even if
it is `undefined`, so a cold start with no file open still shows the expected
"Open a source file to enable scope filters" hint.

## Files touched

- [src/activation-listeners.ts](../src/activation-listeners.ts) —
  `setupScopeContextListener` now guards against the `undefined` editor case.
- [src/test/ui/scope-context-listener.test.ts](../src/test/ui/scope-context-listener.test.ts) —
  new regression test.
- [CHANGELOG.md](../CHANGELOG.md) — `Fixed` entry under Unreleased.
