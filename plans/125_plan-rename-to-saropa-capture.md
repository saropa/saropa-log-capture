# 125 — Rename "Saropa Log Capture" to "Saropa Capture"

Status: Proposed. Not started. Requires owner sign-off on the breaking-change decisions in section 2 before any edit.

## 1. Scope (measured)

Counts from a repo-wide scan (excluding node_modules, out, dist, .git):

| Pattern | Becomes | Occurrences | Files |
|---|---|---|---|
| `Saropa Log Capture` (display) | `Saropa Capture` | ~1,438 | 178 |
| `saropa-log-capture` (kebab ID, repo, folder) | `saropa-capture` | ~324 | 76 |
| `saropaLogCapture` (settings/command prefix) | `saropaCapture` | ~1,582 | 316 |
| `saropa.saropa-log-capture` (marketplace ID) | `saropa.saropa-capture` | ~59 | 30 |
| `github.com/saropa/saropa-log-capture` | `.../saropa-capture` | ~188 | 14 |

Standalone "Log Capture" (without "Saropa") must be reviewed by hand: some hits are the product name, others are the generic feature noun ("log capture" = the act of capturing). Only the product name changes.

## 2. Decisions needed first (breaking changes)

1. **Marketplace extension ID.** `saropa.saropa-log-capture` → `saropa.saropa-capture` is a different extension to VS Code/Open VSX. Existing installs do not auto-migrate; users must reinstall and lose nothing on disk but lose extension-scoped state. Options:
   - A. Publish new ID, deprecate old ID with a redirect notice (clean, standard; breaks installs).
   - B. Keep the old ID, change display name only (no break; ID and name diverge permanently).
2. **Settings prefix `saropaLogCapture.*` → `saropaCapture.*`.** Every user `settings.json` entry stops working. Options:
   - A. Rename and ship a one-time migration that copies old keys to new keys across user/workspace/folder scopes, then notifies.
   - B. Keep the old prefix (zero migration, prefix no longer matches name).
3. **Command IDs `saropaLogCapture.*` → `saropaCapture.*`.** Breaks user keybindings, tasks, and other Saropa extensions that invoke commands (suite integration, plans 105/107). Same A/B choice; follow decision 2.
4. **GitHub repo + local folder rename.** Repo rename keeps GitHub redirects; folder `d:\src\saropa-log-capture` rename affects every other project's additional-working-directory config and the Claude project-memory path.
5. **Log folder / file names** (e.g. `reports/`, session file prefixes) — confirm none embed the old name; if any do, keep reading old names forever.

Recommendation: A for 1–3 (full rename plus migration), executed in one release. Splitting the identity across two names is permanent confusion.

## 3. Work streams

Each stream is one commit. Order matters: 3.1 before everything.

### 3.1 Identity and manifest
- `package.json`: `name`, repository/bugs/homepage URLs, all `saropaLogCapture.*` setting keys, command IDs, view/container IDs, menu `when` clauses, walkthrough IDs, activation events, `displayName` indirection.
- `package-lock.json`: package name entries.
- Every `"title": "Saropa Log Capture: …"` command title → `Saropa Capture: …` (about 110 titles incl. lines 379–544).
- Setting descriptions mentioning the product (e.g. the Database API description near line 2482).
- `scripts/modules/publish/marketplace-gallery-query-body.json` and `scripts/modules/publish/constants.py` (kebab ID, publisher.name).

### 3.2 Runtime source (`src/`)
- Settings reads: `getConfiguration('saropaLogCapture')` and every dotted key (heaviest: `activation-listeners.ts`, 52). Centralize the prefix in one constant (single source of truth) rather than editing 316 files with literals.
- `extension-logger.ts`: output channel name `Saropa Capture`.
- `app-identity.ts`, `deep-links.ts` (URI authority is the extension ID — old deep links must keep resolving for one release), diagnostics, suite handshake (plans 105/107: coordinate with sibling extensions so the handshake accepts both IDs during transition).
- `src/l10n/strings-*.ts` English values; webview HTML titles, panel titles, tab/view titles, status bar text, tooltips, notifications, welcome/empty states, About screen, error messages, issue-report text.
- Webview JS template literals (shared scope): header/brand strings, copy-to-clipboard footers, export headers (HTML/MD/JSON exports that embed the product name).
- Settings migration module (new): on activation, for each old key with an explicit value in any scope, write to the new key if unset, then log and show a one-time notice. Remove after N releases.
- Command alias period: optionally register old command IDs as thin aliases to new ones for one release (only if decision 3 = A with grace).

### 3.3 Localization
- `package.nls.json` + 10 locale files (`de, es, fr, it, ja, ko, pt-br, ru, zh-cn, zh-tw`): ~68 hits each. Value-only replace of the brand phrase; keys unchanged. Hand edit allowed; do NOT run NLLB/Google translation.
- `l10n/bundle.l10n*.json` (11 files, ~27 hits each) and `l10n/provenance/*.json` (10 files): brand replace only. Provenance hashes keyed on English source change when the English changes — confirm the sync step does not queue those strings for machine translation; any re-translation is operator-run only.
- `scripts/modules/verify/l10n_brands.py` + `test_l10n_brands.py`: brand-shield list gains `Saropa Capture`; keep `Saropa Log Capture` in the list for one release so stale strings are still detected, then drop.
- `plans/guides/localization.md`, `terminology.md`: update.
- Run `npm run verify-nls` and `npm run verify:nls-coverage`.

### 3.4 Scripts and tooling
- `scripts/publish.py`, `scripts/remove_extension.py` (also uninstall the OLD ID so dev machines do not run both), `scripts/modules/publish/*.py`, `generate/list-commands.mjs`, `verify/verify-safe-setting-defaults.mjs`, `test/vscode-stub.cjs`.
- Regenerate catalogs: `npm run generate:list-commands`, `generate:webview-catalog`, `generate:host-outbound-catalog` (`plans/reference/contributes-commands.md` alone has 133 hits).
- VSIX filename in packaging, `.vscodeignore`, any hard-coded `saropa-log-capture-*.vsix` globs.

### 3.5 Documentation
- `README.md` (~45), `CONTRIBUTING.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `ABOUT_SAROPA.md`, `bugs/ISSUE_REPORT_GUIDE.md`, `examples/*`, `.claude/rules/*`, `.claude/skills` content that names the product.
- `CHANGELOG.md`: add the rename entry (version heading only, no date). Do not rewrite history entries.
- `CHANGELOG_ARCHIVE.md` (~457 hits) and `plans/history/*`: leave as is; they are historical records. Add a one-line note at the top of the archive stating the former name.
- Active `plans/*.md`: update names in prose; plan filenames containing the old slug stay.
- README: add a "Formerly Saropa Log Capture" line for marketplace search continuity; keep "Log Capture" in `keywords` in `package.json` so existing searchers still find it.
- Screenshots/images with the old name baked in (`images/icon-concept.svg`, `plans/SCREENSHOTS_PLAN.md` assets, README/marketplace screenshots, walkthrough images): list, re-capture, replace.

### 3.6 Screens, tabs, and UI surfaces (checklist)
Verify each shows `Saropa Capture` after the change (manual check in Extension Development Host):
- Activity bar / sidebar container title and view titles
- Log Viewer panel title, tab title, webview `<title>`, header/brand strip
- Session history, comparison, investigation, groups/collections views
- Status bar item text and tooltip
- Output channel dropdown entry
- Command Palette: every `Saropa Capture: …` command
- Settings UI: extension header and every setting group (`@ext:saropa.saropa-capture` filter)
- Walkthrough: title, steps (`media/walkthrough/*.md`)
- Welcome/empty states, About Saropa screen, Signals/Trouble panels
- Notifications, error toasts, quick-pick placeholders, input prompts
- Export outputs (HTML/MD/JSON/CSV headers and footers), issue-report template text
- Crash/diagnostic bundles and any "copy details" text
- Deep-link handler (`vscode://saropa.saropa-capture/...`)

### 3.7 Config, CI, GitHub
- `.github/ISSUE_TEMPLATE/*`, `.github/SECRETS.md`, workflows referencing repo/ID, `.devcontainer/devcontainer.json`, `.vscode/launch.json`, `.vscode/settings.json` (setting keys), `.vscode/TEST-EXTENSION.md`, `.gitignore`.
- Repo rename on GitHub (after merge), update badges and links, remote URLs on dev machines.
- Marketplace + Open VSX: publish new ID; set old listing description to point to the new one and mark deprecated.
- Sibling Saropa projects (drift advisor, drift viewer, lints, contacts, etc.): do not edit from here. File a bug report in each project's `bugs/` listing where they reference the old extension ID, setting prefix, or command IDs.

### 3.8 Tests
- ~25 test files under `src/test/**`: update literals; add tests for the settings migration (old→new copy, no overwrite of explicit new value, all scopes, idempotent) and old-deep-link acceptance.
- Add a guard test/script that fails on any remaining `Saropa Log Capture`/`saropaLogCapture` outside an allowlist (CHANGELOG_ARCHIVE, plans/history, migration module, brand-list legacy entry).

## 4. Execution order

1. Owner decisions (section 2).
2. Branch `rename-saropa-capture`.
3. 3.1 + 3.2 (identity, prefix constant, migration) — build, `check-types`, `compile`.
4. 3.8 tests.
5. 3.3 localization (English + brand-only locale replace).
6. 3.4 scripts and regenerated catalogs.
7. 3.5 docs and changelog.
8. Full gates: `check-types`, `lint`, `compile`, tests, then manual pass over the 3.6 checklist in F5.
9. Merge, publish new ID, deprecate old listing, rename GitHub repo, then local folder.
10. Cross-project bug reports (3.7).

Mechanical replace is scriptable (`d:\tmp\` Python script, longest pattern first: FQID → URL → kebab → camel → display), but every run must be followed by a diff review; "Log Capture" prose hits are hand-reviewed.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Users lose settings | Migration module + one-time notice |
| Users lose keybindings/tasks | Old command aliases for one release; changelog note |
| Marketplace search ranking reset | Old listing deprecation pointer; keep keyword "log capture" |
| Sibling extensions break on new ID | Dual-ID handshake window; bug reports to each project |
| Machine-translation re-queue | Brand-only replace; no MT run without explicit operator command |
| Over-replace of generic "log capture" noun | Hand review of standalone hits; allowlist guard |
| 300-LOC and function limits when adding migration | Separate module, small functions |

## 6. Done criteria

- Zero occurrences of the old strings outside the allowlist (guard script passes).
- All 3.6 surfaces verified in F5 with the new name.
- Migration verified with a profile holding old-prefix settings.
- `verify-nls`, `verify:nls-coverage`, catalogs, `compile`, tests all pass.
- CHANGELOG entry present; old marketplace listing points to the new one.
