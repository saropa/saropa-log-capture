# Plan 055 — Changelog + git history features in the log viewer

## Status: Draft (awaiting scope sign-off)

<!-- Status: Draft → Approved → In progress (Stage N) → Done. Do not start coding until a stage is approved. -->

Goal: bring the crashlytics detail's **"In your project"** intelligence (git blame, recent commits at a
location, and the **changelog-since-affected-version "may already be fixed"** signal) into the **main log
viewer**, so the same editor-native angle applies to ordinary log lines and to the session as a whole —
not just to Crashlytics issues.

This generalizes work already shipped for Crashlytics (plan 054 Stage 5c):
[crash-changelog.ts](../src/modules/crashlytics/crash-changelog.ts) (pure changelog parser, unit-tested),
[crash-project-links.ts](../src/modules/crashlytics/crash-project-links.ts) (recent commits + annotations +
changelog-since + related PRs/issues), and
[analysis-project-insights.ts](../src/ui/analysis/analysis-project-insights.ts) (renderer).

**Sibling plan:** [035 — Log diff from Git](035_plan-log-diff-from-git.md) compares a *session* to a
previous *commit*. This plan is complementary: it links *individual lines* and the *session's app version*
to git history + the changelog. Keep them distinct; share the git plumbing where possible.

---

## Current state (honest baseline)

- **Git blame already exists in the log viewer — but only on demand, per frame.** The analysis panel
  ([analysis-frame-handler.ts](../src/ui/analysis/analysis-frame-handler.ts) `analyzeFrame` → `getGitBlame`)
  shows blame for a stack frame when the user runs **Analyze** on a line. There is **no** recent-commit
  list, **no** changelog awareness, and nothing at the session level.
- **Source references are detected and clickable.** `extractSourceReference` + `.source-link` elements +
  the context menu's `collectSourceRefsForLineRange` already give us `{file, line}` for a log line and an
  "Open Source" action ([viewer-context-menu-sources.ts](../src/ui/viewer-context-menu/viewer-context-menu-sources.ts)).
- **The changelog/git "may already be fixed" logic is Crashlytics-only.** It lives under
  `src/modules/crashlytics/` and is keyed off a Crashlytics issue's affected version. Nothing surfaces it
  for a captured log session.
- **The session's app version is detectable.** `detectAppVersion` (used by `crashlytics-api.ts`) reads the
  app version from log headers (`Project:` / version line). Not yet consumed by any viewer-side git feature.

---

## Pillars

### Pillar A — Move the shared logic out of `crashlytics/`

The changelog parser and the project-links orchestrator are not crashlytics-specific. Promote them so the
log viewer can reuse them without importing from `modules/crashlytics/`:

- Move `crash-changelog.ts` → `src/modules/git/changelog.ts` (pure; re-export from the old path during a
  deprecation window so crashlytics imports keep working, then update them).
- Extract the generic parts of `crash-project-links.ts` (recent commits, annotations, changelog-since,
  related PRs/issues) into `src/modules/git/project-links.ts`, taking `{file, line, version, errorTokens}`.
  Crashlytics keeps a thin wrapper that maps an issue → those inputs.
- Keep the **honesty rules** intact: changelog-since reports `found:false` when the version is absent;
  git/IO are best-effort; never imply "nothing changed."

### Pillar B — Per-line git context in the viewer

For a log line that carries a source reference (or a clicked stack frame):

- **Context-menu actions** (right-click on a source-linked line): "Blame this line", "Recent commits for
  this file", "Open file at line". Wire via the existing menu pattern (`data-action` → `onContextMenuAction`
  → `vscodeApi.postMessage({ type: 'showGitHistoryForLine', lineIndex })`) and a new handler in
  [viewer-message-handler-actions.ts](../src/ui/provider/viewer-message-handler-actions.ts).
- **Inline result**: render blame + the last N commits in the existing **context popover** (reuse the
  popover, not a new surface), styled like the crashlytics `.cd-proj` rows.
- Gate on a source reference being present; lines without one don't get the actions.

### Pillar C — Session-level "Project state" + "may already be fixed"

A passive, collapsible **session panel** (icon-bar slide-out, mirroring the crashlytics panel pattern)
that answers "what is the state of the code that produced this log?":

- **Project state**: current branch, last commit (`hash · author · when · subject`), and whether the tree
  is dirty — so a reader knows which code the log corresponds to.
- **"May already be fixed"**: detect the session's app version (`detectAppVersion`), parse the workspace
  `CHANGELOG*`, and if releases are listed **after** that version, show the same warning banner +
  newer-release list the crashlytics detail uses. The headline insight, now for any captured session.
- **Errors-since**: optional cross-link — for error lines in the session whose source file changed in a
  release after the session's version, mark them "touched since this version."
- Passive by default (per the Signals-style rule): hidden until it has something to say; never nags.

### Pillar D (stretch) — Changelog lookup for a selected version token

When a log line contains a version string, offer "What changed since this version?" → changelog-since for
that token. Small, builds on Pillar A. Defer unless cheap.

---

## Staged delivery

- **Stage 1 — Pillar A refactor (no UI change).** Promote `changelog.ts` + `project-links.ts` into
  `modules/git/`; point crashlytics at the shared module; tests move with the parser. Pure refactor,
  green tests before/after. **Gate for B and C.**
- **Stage 2 — Pillar B (per-line git context).** Context-menu actions + popover rendering for blame +
  recent commits on a source-linked line. Reuses the popover and the shared module.
- **Stage 3 — Pillar C (session Project-state panel + may-already-be-fixed).** New slide-out panel;
  `detectAppVersion` → changelog-since; project state (branch/last-commit/dirty). Passive gating.
- **Stage 4 (stretch) — Pillar D.** Version-token changelog lookup.

Each stage ships independently and must be fully stable before the next (per `.claude/rules/global.md`).

---

## Blast radius / risks (sign-off before coding)

- **Module move (Pillar A)** touches every crashlytics importer of `crash-changelog` / `crash-project-links`
  — mechanical but cross-file; do it as its own commit with a re-export shim first.
- **New slide-out panel (Pillar C)** = new webview message types (run `generate:webview-catalog` /
  `generate:host-outbound-catalog`), new NLS keys across locales, and an icon-bar entry. Mirror the
  crashlytics panel so the pattern is consistent.
- **Git subprocess cost**: per-line blame/commits are subprocesses; cap counts, debounce, best-effort,
  never block the UI (follow `crash-frame-context.ts` caps).
- **File-size discipline**: keep new files ≤300 lines; split renderer vs data vs script like the
  crashlytics modules.
- **Honesty in UI**: changelog-since must say "version not found" rather than imply nothing changed;
  blame/commits absent (untracked file, no git) degrade silently.

---

## Open decision (for the user)

Recommendation: **start with Stage 1 (the Pillar A refactor)** — it's a no-UI, low-risk move that unlocks
B and C and removes the awkward cross-import of crashlytics internals from viewer code. Then Stage 3
(session "may already be fixed") for the highest user-visible value, then Stage 2 (per-line context).
After approval, add a `ROADMAP.md` row and link this plan.
