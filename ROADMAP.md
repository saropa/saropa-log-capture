# Roadmap & Project Review

Planned features for future releases, plus a consolidated project review (potential issues, enhancement opportunities, competitive positioning, and recommendations). *Review date: 2026-03-01.*

---

## 1. Planned Features (Roadmap)

### Tier 4: Differentiators

| # | Feature | Description |
|---|---|---|
| 74 | .slc session bundle | ZIP export containing logs + metadata + annotations + pins |
| 75 | .slc import | Drag-and-drop import, appears in session history |

### Tier 5: Ecosystem

| # | Feature | Description |
|---|---|---|
| 89 | Tail mode | Watch workspace .log files (file watcher, configurable globs) |
| 90 | Remote workspace / SSH | Enterprise environment support |
| 92 | External log service integration | Logz.io, Loki, Datadog export |

### Feature Details

**Session Bundle (Tasks 74-75)** — Full session portability. .slc bundle (ZIP) contains: log file(s) including split parts, session metadata JSON, annotations and pinned entries, split metadata. Import: drag-and-drop .slc files into session history.

**Tail Mode (Task 89)** — Watch any .log file in the workspace; file watcher on configured glob patterns; configurable e.g. `saropaLogCapture.tailPatterns: ["*.log", "logs/**/*.txt"]`.

**Remote Workspace (Task 90)** — Support for SSH Remote, WSL, and Dev Containers.

**External Log Services (Task 92)** — Export sessions to Logz.io, Grafana Loki, Datadog.

---

## 2. Potential Issues

### 2.1 Documentation & Consistency

| # | Issue | Location | Severity | Notes |
|---|--------|----------|----------|--------|
| 1 | Plan.md footer consolidation | plan.md | Low | Verify plan vs. current UX; update plan or implement remaining moves. |
| 2 | CHANGELOG URL in About loader | about-content-loader.ts | Low | Hardcoded Marketplace changelog URL; consider configurable or derived from package.json. |

### 2.2 Code & Architecture

| # | Issue | Location | Severity | Notes |
|---|--------|----------|----------|--------|
| 3 | CSP `unsafe-inline` in viewer | viewer-content.ts | Medium | `style-src` includes `'unsafe-inline'`; consider narrowing if possible. |
| 4 | No explicit accessibility (a11y) | src/ webview UI | Medium | Add aria-label, role where helpful; document keyboard shortcuts. |
| 5 | About panel loads CHANGELOG from disk | about-content-loader.ts | Low | Consider bundling a short "recent changes" blob at build time. |

### 2.3 Testing & Quality

| # | Issue | Severity | Notes |
|---|--------|----------|--------|
| 6 | Test distribution | Low | Consider integration tests for critical webview flows. |
| 7 | verify-nls in compile | Info | Keep all locale files updated when adding NLS keys. |

### 2.4 Security & Privacy

| # | Issue | Severity | Notes |
|---|--------|----------|--------|
| 8 | Redaction | Low | Docs could recommend patterns for secrets (API keys, tokens). |
| 9 | Crashlytics / Play | Low | User-managed; no hardcoded secrets. |
| 10 | Deep links | Low | Ensure no sensitive data in `vscode://` query params. |

### 2.5 Platform & Dependencies

| # | Issue | Severity | Notes |
|---|--------|----------|--------|
| 11 | Node / engines | Low | Document supported VS Code version (^1.108.1). |
| 12 | Publish script | Low | Ensure CI uses same Python/encoding if automated. |

---

## 3. Feature Enhancement Opportunities

### 3.1 High-Value (Aligned with Intent)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Tail mode / file watcher | Task 89; same viewer, different source. |
| 2 | .slc session bundle | Tasks 74–75; full session portability. |
| 3 | Remote / SSH / Dev Containers | Task 90. |
| 4 | External log services | Task 92; Logz.io, Loki, Datadog. |
| 5 | More integration adapters | Database, HTTP/network, browser DevTools, WSL/linux logs, security audit (bugs/integration-specs-index). |
| 6 | Terminal output correlation | When VS Code exposes terminal API (docs/deferred/TERMINAL_OUTPUT_CAPTURE.md). |

### 3.2 UX Polish

*(Completed items removed: footer consolidation, viewer line cap in README, keyboard shortcut cheatsheet, preset "last used", session list date filter, copy as snippet.)*

### 3.3 Performance & Scale

| # | Feature | Description |
|---|---------|-------------|
| 14 | Lazy load session list | Virtualize or paginate for 100+ sessions. |
| 15 | Incremental index for search | Extend project indexer for "search in all logs". |

### 3.4 Analytics & Insights

| # | Feature | Description |
|---|---------|-------------|
| 16 | Error rate over time | Chart: errors/minute over session. |
| 17 | Session comparison (3-way) | Compare three sessions. |
| 18 | Export Insights summary | CSV/JSON of recurring errors + hot files. |

---

## 3.5 Implementation effort (easiest first)

Items below are ordered by effort so you can pick quick wins. **Effort:** Docs = docs/config only, no code. Small = one file or one clear code path. Medium = reuse existing patterns, a few touchpoints.

*(Completed easy items removed: Plan.md footer consolidation, VS Code version docs, redaction docs, viewer line cap in README, CHANGELOG URL in About loader, copy as snippet, keyboard shortcut cheatsheet, preset "last used", minimal a11y.)*

### Harder (not in "easiest" set)

Tail mode (§1 Task 89), .slc bundle (§1 Tasks 74–75), Remote/SSH (§1 Task 90), external log services (§1 Task 92), 3-way session compare (§3.4 #17), and most "Wow" ideas (§4) require new APIs, file watchers, or larger UX work.

---

## 4. "Wow" Feature Ideas

| # | Idea | Description |
|---|------|-------------|
| 1 | AI "Explain this error" | Right-click → Explain with AI (VS Code Language Model API). |
| 2 | Live collaboration | Share session; others see same log and scroll position. |
| 3 | Regression hints | "This error pattern appeared after commit X." |
| 4 | Noise learning | "Hide/highlight lines like this" from user choices. |
| 5 | Log diff from Git | Compare session to previous commit. |
| 6 | Voice / TTS | Read selected lines or errors. |
| 7 | Session replay | Replay log with simulated timing. |
| 8 | Smart bookmarks | Auto-suggest at first error per run or watch patterns. |
| 9 | One-click "Open in Grafana/Loki" | Send to Loki with session metadata. |
| 10 | Bidirectional sync | Reload/merge when log file is modified externally. |

---

## 5. Competitor & Positioning Summary

| Product | Focus | Relation to Saropa |
|---------|--------|---------------------|
| **Saropa Log Capture** | Persist Debug Console to files + viewer | Only extension that auto-saves debug console to disk with rich viewer. |
| Turbo Console Log | Automate console.log in code | Does not persist Debug Console. |
| Console Warrior | Inline console visualization (Vite) | No persistence. |
| Log Viewer Tools | console.log by file (Node/frontend) | Different capture path. |
| Console.log Manager | Find/delete console statements | Cleanup only. |
| Log File Highlighter | Syntax highlight .log files | Viewing only. |
| Activity Logger | VS Code activity to file | Not debug output. |

**Positioning:** Primary use case = never lose debug output; persist, search, export, analyze. Differentiator = only extension that persistently captures **Debug Console** (any adapter) with zero config. Opportunity = tail mode, remote workspaces, cloud export, and "wow" features (AI, collaboration, replay).

---

## 6. Codebase Health Summary

| Area | Finding |
|------|---------|
| Layout | `src/modules/` (capture, session, config, analysis, export, integrations); `src/ui/` (provider, viewer-*, panels). Tests under `src/test/`. |
| File size | ESLint max-lines 300, max-params 4, max-depth 3. |
| Tooling | TypeScript strict, ES2022; ESLint; esbuild; verify-nls; Mocha + @vscode/test-electron; publish.py. |
| Localization | 11 locales (manifest + l10n bundle). |

---

## 7. Recommendations (Prioritized)

### Do Soon *(completed 2026-03-01)*

1. ~~Update **README Known Limitations** to match current viewer cap (`maxLines`, "first X of Y lines").~~ Done: settings table includes `viewerMaxLines`; Known Limitations and keyboard shortcuts table in README.
2. ~~Update **bugs/integration-specs-index.md** so implemented adapters are marked Done.~~ Done: clarifying sentence added; adapters already marked.
3. ~~Add **minimal a11y** (aria-label, role) and document keyboard shortcuts in one place.~~ Done: extended a11y in viewer (log role, nav/slider aria-labels); shortcuts in README + link to docs/keyboard-shortcuts.md.

### Do Next

4. Implement **tail mode** (89) and **.slc bundle** (74–75).
5. Finish **footer consolidation** (plan.md); verify Options panel is single source of truth.
6. Consider enabling **stricter tsconfig** options (noImplicitReturns, noFallthroughCasesInSwitch, noUnusedParameters).

### Consider for "Wow"

7. **AI "Explain this error"** (VS Code Language Model API).
8. **Session replay** with optional timing.
9. **One-click export to Loki/Grafana** when configured.

---

## 8. Appendix: Snapshot Counts

| Category | Approx. count |
|----------|----------------|
| Source .ts files (src/) | ~321 (including test) |
| Test files (src/test) | ~48 |
| Integration spec docs (bugs/) | 18+ |

---

*For changelog format and release cadence, see [CHANGELOG.md](CHANGELOG.md). For full design principles and code standards, see [CONTRIBUTING.md](CONTRIBUTING.md) and [STYLE_GUIDE.md](STYLE_GUIDE.md).*
