# Cross-Session Analysis — Remaining Work

The cross-session analysis roadmap (20 feature ideas) is complete except for the two items below.
The full history — the other 18 ideas, the architecture, design principles, and per-feature finish
reports — lives in the archived roadmap at
[plans/history/2026.06/2026.06.14/cross-session-analysis.md](history/2026.06/2026.06.14/cross-session-analysis.md).

This file tracks only the still-open scope so the active `plans/` tree reflects what's left to build.

---

## 1. Smart Context Boundaries — DONE (2026-06-25)

Built as a refinement of the idea-#15 pause note, in
[time-travel-context.ts](../src/modules/bug-report/time-travel-context.ts): `findContextBoundary()`
walks backward from the error and returns the start of the operation it belongs to using blank
lines and timestamp gaps (strong, nearest wins) with a severity escalation as a weak fallback;
`formatContextInsights()` renders the boundary note plus the largest-pause note, deduped so one gap
is never reported twice. Wired into the Log Context section of the bug report
([bug-report-sections.ts](../src/modules/bug-report/bug-report-sections.ts)); the fixed window is
still shown in full (annotation only, no shrink). Pure + unit-tested
([time-travel-context.test.ts](../src/test/modules/bug-report/time-travel-context.test.ts), 13 cases).

<details>
<summary>Original spec</summary>


Instead of always showing a fixed N lines before an error, use blank lines, timestamp gaps, and
log-level changes to find the logical boundary of the operation the error belongs to.

**Example:** if there's a blank line (or a >1s timestamp gap) three lines before the error, the
relevant context probably starts there — not 15 lines back in a different operation.

**Implementation:** a pure helper that walks backward from the error line, tracking blank lines,
timestamp gaps (reusing `extractTimestamp` from `src/modules/timeline/timestamp-parser.ts`), and
log-level transitions, and returns the index of the first boundary. Surface in the bug report's Log
Context section (host markdown, like the idea-#15 pause note that already lives there) — show the
trimmed-to-boundary context, or annotate where the operation boundary is. Keep the existing fixed
window as the fallback when no boundary is detected (do not shrink existing behavior). This overlaps
the already-shipped idea-#15 "largest pause" note; build it as a refinement of that context section,
not a parallel mechanism.

**Effort/impact:** Low effort, Medium impact. Pure core is unit-testable; the bug-report render is
verifiable by reading a generated report.

</details>

---

## 2. Investigation Groups — DONE via commands (2026-06-25); webview tree-parent rendering deferred

**Built (2026-06-25):** the curated named layer over auto-grouping, command-driven and fully usable.
- **Persistence:** workspaceState (the simpler, private option — the open question below is resolved
  in favor of workspace state; the shareable `reports/.investigations.json` file stays a follow-up).
  Pure model [investigation-model.ts](../src/modules/session/investigation-model.ts) +
  [investigation-store.ts](../src/modules/session/investigation-store.ts).
- **Commands** (palette + Logs-panel right-click for add/remove):
  [commands-investigations.ts](../src/commands-investigations.ts) /
  [-open.ts](../src/commands-investigations-open.ts) /
  [-helpers.ts](../src/commands-investigations-helpers.ts) — New, Add to, Remove from, Rename, Edit
  Notes, Delete, and Open (overview or a member session).
- **Overview document** [investigation-overview.ts](../src/modules/session/investigation-overview.ts)
  — one markdown page (title, notes, member sessions with error/warning counts + per-session notes
  and clickable links) so a multi-session effort "reads as one thing".
- **Tests:** pure model + overview, 11 cases
  ([investigation-model.test.ts](../src/test/modules/session/investigation-model.test.ts),
  [investigation-overview.test.ts](../src/test/modules/session/investigation-overview.test.ts)).

**Deferred (display polish, not built):** rendering investigations as **parent nodes inside the
Logs panel tree**. The Logs panel is a webview (there is no native sessions TreeView), so a
persistent tree-parent row is a webview-rendering change with its own design pass; the
command-driven surface + overview document deliver the value without it. Membership is surfaced
today via the right-click "Add to / Remove from Investigation" actions and the Open command.

<details>
<summary>Original spec</summary>

Bundle related sessions into named investigations with a custom title and notes, so a multi-session
debugging effort reads as one thing:

```
"Bug #42: Payment timeout"
├── session_2026-01-15_1430.log  (first occurrence)
├── session_2026-01-15_1630.log  (after fix attempt 1)
├── session_2026-01-16_0900.log  (after fix attempt 2 — clean!)
└── notes: "Root cause was connection pool exhaustion"
```

**Already shipped (do not rebuild):** automatic session grouping by time window / DAP boundary —
`src/modules/session/session-groups.ts` + `session-group-tracker.ts`, with manual group/ungroup
commands. The session note (idea #7) also already attaches free-text notes to a single session.

**Remaining:** the curated layer on top of automatic grouping —
- A human-named investigation (custom title) spanning chosen sessions, distinct from the
  auto-assigned `groupId`.
- Investigation-level notes (the auto-grouping has no title/notes of its own).
- Persistence: workspace state vs a shareable `reports/.investigations.json` (open question — a
  shareable file is git-committable and travels with the repo; workspace state is private/simpler).
- A surface to create/name an investigation and add sessions to it (Logs panel context menu, mirroring
  the existing group/note actions), and to display the investigation as a tree parent.

**Effort/impact:** Medium effort, Medium impact. Larger than item 1 — it needs a storage decision,
a new metadata shape (named investigations are not the same as `groupId`), and webview/tree UI, so
it warrants its own design pass before implementation.

**Open question (carried from the roadmap):** should investigation groups persist in workspace
state or in a `reports/.investigations.json` file shareable via git?

</details>
