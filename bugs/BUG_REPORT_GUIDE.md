# Bug Report Guide

How to file, investigate, and close bugs in `saropa-log-capture`.

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Bug | `bug_NNN_short-description.md` | `bug_003_severity-keywords-null-crash.md` |
| Feature plan | `NNN_plan-short-description.md` | `036_plan-voice-tts.md` |

Use the next available number. Check existing files before picking one.

---

## Bug Report Template

Copy the block below into a new file.

````markdown
# Bug NNN — Short, Specific Title

## Status: Open

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Problem

One or two sentences describing what the user sees.

```
Paste the exact error message or unexpected output here.
```

## Environment (if relevant)

- VS Code version:
- Extension version:
- OS:
- Debug adapter / language:

## Reproduction

1. Step one
2. Step two
3. Step three (crash / wrong result)

**Frequency:** Always / Intermittent / Once

## Root Cause

<!-- Fill in during investigation. Explain *why* the bug happens, not just where. -->

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

### File 2: ...

## Tests Added

<!-- List new or updated test files and what they verify. -->

## Commits

<!-- Add commit hashes as fixes land. -->
- `abcdef0` fix(scope): description
````

---

## What Makes a Good Bug Report

### Title

- Start with the affected area: `Options Panel Crash`, `Viewer Filter`, `Session Persistence`
- Be specific: "null dereference" beats "crash", "lines disappear" beats "filter broken"

### Problem

- Include the **exact error message** with stack trace if available
- Describe **what you expected** vs **what happened**
- If it's a webview error, note the function name and line from the stack trace

### Reproduction

- Minimum steps to trigger the bug — nothing extra
- Note whether the bug requires a specific config, log format, or timing
- If it only happens with certain data, include a minimal sample

### Root Cause

- Explain the **mechanism**, not just the location
- Reference specific lines and the logic that fails
- If the root cause spans multiple files (e.g. a data flow break), trace the full chain

---

## Investigation Checklist

Use this when diagnosing a new bug.

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

---

## Fix Requirements

Every bug fix must satisfy these before it can be closed.

### Code

- [ ] Fix addresses the **root cause**, not just the symptom
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

- [ ] `CHANGELOG.md` updated under `[Unreleased]` with a `### Fixed` entry
- [ ] Bug report file updated with root cause, changes, and commit hashes
- [ ] Status updated to `Fixed (pending review)`

---

## Lifecycle

```
Open
  │
  ▼
Investigating       ← actively diagnosing
  │
  ▼
Fix Ready           ← code written, tests pass, PR open
  │
  ▼
Fixed (pending review)  ← merged to main, awaiting manual verification
  │
  ▼
Closed              ← verified, file moved to bugs/history/YYYYMMDD/
```

### Moving to History

When a bug is closed, move its file:

```
bugs/bug_003_severity-keywords-null-crash.md
  → bugs/history/YYYYMMDD/bug_003_severity-keywords-null-crash.md
```

Use the date the bug was closed. Update any ROADMAP.md references to point to the new path.

---

## Severity Guide

Use these labels in ROADMAP.md's "Known issues" table.

| Severity | Meaning | Examples |
|----------|---------|---------|
| Critical | Extension unusable, data loss | Crash on activate, logs not saved |
| High | Major feature broken | Viewer won't open, filters don't apply |
| Medium | Feature degraded but workaround exists | Options panel crash (can avoid by waiting for config) |
| Low | Cosmetic or minor inconvenience | Alignment off, tooltip wrong |

---

## Linking

- Reference bugs from commits: `fix(viewer): description (bug_003)`
- Reference bugs from ROADMAP: `[003](bugs/bug_003_severity-keywords-null-crash.md)`
- Reference bugs from CHANGELOG: plain text description is fine, no link needed
