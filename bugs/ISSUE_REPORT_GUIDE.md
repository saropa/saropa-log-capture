# Issue Report Guide

How to file, investigate, and close bugs and feature requests in `saropa-log-capture`.

**Feature requests are in scope.** New commands, viewer capabilities, settings, webview features, infrastructure improvements, and tooling enhancements belong here under `bugs/` using the [Feature request](#feature-request) naming pattern and the [feature request template](#feature-request-template).

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Crash / error | `bug_NNN_crash_description.md` | `bug_003_crash_severity-keywords-null.md` |
| Wrong behavior | `bug_NNN_description.md` | `bug_012_viewer-filter-drops-markers.md` |
| Webview rendering | `bug_NNN_viewer_description.md` | `bug_015_viewer_blank-rows-full-height.md` |
| New feature | `NNN_plan-description.md` | `036_plan-voice-tts.md` |
| Tooling / infra | `NNN_plan-infra-description.md` | `041_plan-infra-bundle-analyzer.md` |

Use the next available number. Check both `bugs/` (open) and `plans/history/` (closed/archived) before picking one — numbers are never reused. As of 2026-09-03 bugs 001–046 are taken (045 archived, 021 open).

---

## Confirm Attribution Before Filing

**Before filing a bug here, confirm the symptom originates in Saropa Log Capture, not another extension.** The Output panel and webview console can show messages from unrelated extensions. Filing here without proof wastes a round-trip discovering the bug lives elsewhere.

### Quick check

1. Disable all other extensions (`--disable-extensions` or disable in the Extensions sidebar)
2. Reproduce the bug — if it disappears, the cause is another extension
3. Check the Output panel dropdown — is the error in the `Saropa Log Capture` channel or a different one?

If the bug belongs to another project, write a self-contained report in that project's `bugs/` folder instead.

---

## Bug Report Template

Copy the block below into a new file.

Field order and heading levels below match the 46 filed bug reports (archived to `plans/history/2026.09/2026.09.03/bug_*.md`) — do not substitute bold text for the `## Status:` / `## Severity:` headings, and do not add fields (`Area:`, `Created:`) that no filed bug actually uses.

````markdown
# Bug NNN — Short, Specific Title

## Status: Open

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Severity: Critical / High / Medium / Low

One or two sentences on why this severity — who hits it, how often, what it costs them.

## Problem

Describe what the user sees.

```
Paste the exact error message or unexpected output here.
```

## Reproduction

1. Step one
2. Step two
3. Step three (crash / wrong result)

**Frequency:** Always / Intermittent / Once

## Root Cause

<!-- Fill in during investigation. Explain the *mechanism*: which condition
     evaluates wrong, and why. Reference specific lines. -->

## Proposed Fix

<!-- Describe the code change needed. Reference file paths and line numbers. -->

## Changes Made

<!-- Fill in when a fix is written. -->

### File 1: `src/path/to/file.ts` (line NN)

**Before:**
```typescript
old code
```

**After:**
```typescript
new code
```

## Tests Added

<!-- List new or updated test files and what they verify. -->

## Commits

<!-- Add commit hashes as fixes land. -->
- `abcdef0` fix(scope): description
````

An `## Environment` section (VS Code version, extension version, OS, debug adapter) is optional — add it only when the bug is environment-specific (one filed bug out of 46 uses it).

---

## Feature Request Template

Copy the block below into a new file. Unlike the bug template above, existing `plans/NNN_plan-*.md` files are **not** consistently structured (ad-hoc headers, some use `**Feature:**`/`**Status (date): ...**` instead of this template) — this template is the target for *new* filings, not a description of legacy ones. Don't assume an existing plan file matches it.

````markdown
# PLAN NNN — Short, Specific Title

**Status: Open**

<!-- Status values: Open → Accepted → In Progress → Closed -->
<!-- Use "Declined" if rejected, with rationale in the Decision section -->

Created: YYYY-MM-DD
Type: New command / Viewer feature / Setting / Webview UX / Tooling / Infrastructure
Related: `saropaLogCapture.commandName` (if modifying or extending an existing feature)

---

## Summary

One or two sentences: what the feature does and why it matters.

---

## Motivation

Why this feature is needed. Include concrete scenarios where this would improve the debugging experience or save developer time. Link to VS Code extension API docs or similar extensions if applicable.

---

## Behavior

<!-- Describe the expected user-facing behavior -->

### User flow

1. User does X
2. Extension responds with Y
3. ...

### UI / UX

<!-- Describe any UI elements: commands, settings, webview changes, status bar items -->

---

## Edge Cases

<!-- Patterns that need special handling or explicit decisions -->

1. **Case description** — expected behavior / needs discussion
2. ...

---

## Alternatives Considered

<!-- Other approaches and why this one is preferred -->

---

## Decision

<!-- Fill in when the proposal is accepted or declined -->

---

## Implementation Notes

<!-- Fill in when work begins. Reference files, existing patterns, related features -->

---

## Commits

<!-- Add commit hashes as implementation lands -->
- `abcdef0` feat(scope): description
````

---

## What Makes a Good Bug Report

### Title

- Start with the affected area: `Viewer Crash`, `Session Persistence`, `Filter`,  `Options Panel`
- Be specific: "null dereference in calcItemHeight" beats "crash", "lines disappear after level filter" beats "filter broken"

### Problem

- Include the **exact error message** with stack trace if available
- Describe **what you expected** vs **what happened**
- If it's a webview error, note the function name and line from the stack trace

### Reproduction

- **Minimum steps** to trigger the bug — nothing extra
- Note whether the bug requires a specific config, log format, or timing
- If it only happens with certain data, include a minimal sample

### Root Cause

- Explain the **mechanism**, not just the location
- Reference specific lines and the logic that fails
- If the root cause spans multiple files (e.g. a data flow break), trace the full chain: `classify → PendingLine → addToData → lineItem`

---

## Bug Categories

### Crash / Exception

The extension throws or the webview fails.

**Investigation focus:**
- Include the full stack trace from the Output panel or webview console
- Which property is null/undefined that the code assumes exists?
- Does the crash only happen before the first config message arrives (initial state)?

### Wrong Behavior

A feature produces incorrect results.

**Investigation focus:**
- What line types are affected (regular output, stack frames, logcat, launch boilerplate, markers)?
- Does the classifier/filter handle all formats?
- Is a property dropped in the data flow chain (extension → message → webview → lineItem)?

### Rendering / Layout

The webview displays incorrectly.

**Investigation focus:**
- Is a line height being manipulated directly instead of through `calcItemHeight()`?
- Are markers being incorrectly filtered?
- Does the issue appear only with specific themes or font sizes?

### Performance

The extension or webview becomes unresponsive.

**Investigation focus:**
- How many lines are loaded when the slowdown occurs?
- Is `renderViewport()` being called in a tight loop?
- Is a filter recalculating all heights unnecessarily?

---

## Feature Request Categories

### New Command

A VS Code command that does not exist yet.

**Evaluation criteria:**
- Does it serve a concrete debugging workflow?
- Can it reuse existing infrastructure (session, viewer, settings)?
- Is the command palette the right surface, or would a setting/automatic behavior be simpler?

### Viewer Feature

A new capability in the log viewer webview.

**Evaluation criteria:**
- Does it follow the composable filter pattern (classify → flag → calcItemHeight → recalcHeights)?
- Does it handle all line types (regular, stack frame, logcat, marker)?
- Is it discoverable without cluttering the UI?

### Setting

A new user-configurable option.

**Evaluation criteria:**
- Does it follow the settings pipeline (package.json → config.ts → broadcaster → webview)?
- Is the default value sensible for most users?
- Can it be read fresh on each use (users change settings mid-session)?

### Tooling / Infrastructure

Improvements to the build, test, l10n, or release pipeline.

**How to report:** Create `bugs/NNN_plan-infra-description.md` and describe the current behavior, desired behavior, and motivation.

---

## Investigation Checklist

Use this when diagnosing a new bug.

- [ ] **Attribution** — confirmed the symptom is from Saropa Log Capture, not another extension
- [ ] **Reproduce it** — can you trigger it reliably?
- [ ] **Check the webview console** — `Developer: Open Webview Developer Tools`
- [ ] **Check the output channel** — `Saropa Log Capture` in the Output panel
- [ ] **Trace the data flow** — extension → message → webview → render
- [ ] **Check null/undefined guards** — `typeof x !== 'undefined'` does NOT catch `null`
- [ ] **Check all line types** — does the code handle regular output, stack frames, logcat, launch boilerplate, and markers?
- [ ] **Check initial state** — does it work before the first config message arrives?

---

## Common Pitfalls

These patterns have caused bugs before. Check for them during investigation.

| Pitfall | Why It Breaks | Correct Pattern |
|---------|---------------|-----------------|
| `typeof x !== 'undefined'` on a `null` var | `typeof null` is `'object'`, not `'undefined'` | Use truthiness: `if (x && x.prop)` |
| Classifier only handles one line format | Silently passes through unhandled formats | Classifier must cover every line type |
| Dropped property in data flow chain | Feature breaks silently, no error thrown | Trace: `classify → PendingLine → addToData → lineItem` |
| Manipulating line heights directly | Breaks the composable filter pattern | Set a filter flag, let `calcItemHeight()` decide |
| Filtering markers | Markers should always be visible | Skip `item.type === 'marker'` in every filter |
| `typeof` guard before assignment + no null coercion | Inconsistent state (`null` vs `undefined`) | Coerce falsy values: `value || null` |
| Setting blank-row height at render time | Rows born at wrong height stay wrong until next recalc | Fix at birth in `addToData`, not in `calcItemHeight` |

---

## Fix Requirements

Every bug fix must satisfy these before it can be closed.

### Code

- [ ] Fix addresses the **root cause**, not just the symptom
- [ ] Fix includes a comment explaining what was wrong and why the new code is correct
- [ ] No `any` types introduced
- [ ] Functions stay ≤30 lines, ≤4 parameters, ≤3 levels of nesting
- [ ] File stays ≤300 lines of code

### Tests

- [ ] Regression test covers the exact failure scenario
- [ ] Happy path still passes
- [ ] Edge cases covered (null, undefined, empty, boundary)

### Quality Gates

- [ ] `npm run check-types` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run compile` — succeeds
- [ ] Tests pass
- [ ] Manual test in Extension Development Host (F5)

### Documentation

- [ ] `CHANGELOG.md` updated under `[Unreleased]` → `### Fixed`
- [ ] Bug report file updated with root cause, changes, and commit hashes
- [ ] Status updated to `Closed`

---

## Lifecycle

### Bugs

```
Open
  │
  ▼
Investigating       ← actively diagnosing, root cause section being filled in
  │
  ▼
Fix Ready           ← code written, tests pass, awaiting commit
  │
  ▼
Closed              ← merged, verified, file moved to history
```

### Feature Requests

```
Open
  │
  ├──► Declined     ← rejected with rationale, file moved to history
  │
  ▼
Accepted            ← approved, scope decided
  │
  ▼
In Progress         ← implementation underway
  │
  ▼
Closed              ← merged, verified, file moved to history
```

### Moving to History

When an issue is closed (or a proposal is declined), `git mv` its file into the shared history root:

```
bugs/bug_003_crash_severity-keywords-null.md
  → plans/history/YYYY.MM/YYYY.MM.DD/bug_003_crash_severity-keywords-null.md

bugs/036_plan-voice-tts.md
  → plans/history/YYYY.MM/YYYY.MM.DD/036_plan-voice-tts.md
```

Use the date the issue was closed. Create the `YYYY.MM/YYYY.MM.DD` folders if they do not exist. Grep and repoint any `bugs/<file>.md` references (CHANGELOG, ROADMAP, other issue files) to the new path in the same commit.

---

## Severity Guide

| Severity | Meaning | Examples |
|----------|---------|---------|
| Critical | Extension unusable, data loss | Crash on activate, logs not saved |
| High | Major feature broken | Viewer won't open, filters don't apply |
| Medium | Feature degraded but workaround exists | Options panel crash (can avoid by waiting for config) |
| Low | Cosmetic or minor inconvenience | Alignment off, tooltip wrong |

---

## Linking

- Reference bugs from commits: `fix(viewer): description (bug_003)`
- Reference proposals from commits: `feat(viewer): description (036_plan-voice-tts)`
- Reference issues from ROADMAP: `[003](bugs/bug_003_crash_severity-keywords-null.md)` or `[036](bugs/036_plan-voice-tts.md)`
- Reference related history: `Related: plans/history/YYYY.MM/YYYYMMDD/filename.md`

---

## Policy Note

Do not log project-specific findings or proposals directly in this guide.

- This file is process documentation only.
- Every concrete bug or feature request must live in a separate file under `bugs/` using the naming rules above.
- If you discover this happened again, move the content into dedicated issue files immediately and leave only this policy note.
