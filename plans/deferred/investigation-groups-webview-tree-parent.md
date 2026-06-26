# Deferred: Investigation Groups — Logs-panel tree-parent rendering

**Parent feature:** Investigation Groups (cross-session-analysis idea #2), shipped command-driven on
2026-06-25. See [../cross-session-analysis-remaining.md](../cross-session-analysis-remaining.md) §2
and commit `961b3794`.

## What is deferred

Rendering each investigation as a **persistent parent node inside the Logs panel**, with its member
sessions nested beneath it (the tree shape sketched in the original spec):

```
"Bug #42: Payment timeout"
├── 20260115_1430_app.log   (first occurrence)
├── 20260115_1630_app.log   (after fix attempt 1)
└── 20260116_0900_app.log   (after fix attempt 2 — clean!)
```

## What already ships (so this is display polish, not missing function)

The feature is fully usable today without the tree rendering:
- Create / Add to / Remove from / Rename / Edit Notes / Delete / Open via the Command Palette and the
  Logs-panel right-click menu (Add to / Remove from Investigation).
- **Open Investigation** lists the member sessions or opens a one-page markdown **overview** (title,
  notes, each session with its error/warning counts, per-session notes, and clickable links) — which
  is the "reads as one thing" view the tree would also provide.

## Why it was deferred

There is **no native sessions `TreeView`** to add parent nodes to. `package.json` `views` declares
only webview views (`saropaLogCapture.logViewer`, `saropaLogCapture.vitalsPanel`); the visible Logs
panel is the **webview**, and `SessionHistoryProvider` is a data source feeding it, not a rendered
VS Code tree. So a persistent investigation parent row is a **webview-rendering change**, not a cheap
`getChildren()` addition — it touches the webview session-list rendering pipeline
(`src/ui/viewer-panels/viewer-session-panel-rendering*.ts`), the host→webview message payloads, and
the collapse/grouping JS that already renders auto session-groups. That is a sizeable surface with its
own design questions (below), so it was split out rather than half-built.

## Open design questions to settle before building

1. **Overlay vs. move.** Investigation membership is non-destructive — a session stays in its auto
   group and the normal day list. Does an investigation parent row duplicate those sessions (overlay,
   sessions appear in both places) or pull them out (move, one home)? Recommendation: overlay, with a
   distinct investigation icon, to match the non-destructive model the commands already use.
2. **Where the section sits.** A top "Investigations" section above the day groups, or interleaved?
   Recommendation: a collapsible top section (like pinned rows), so it never disturbs day grouping.
3. **Collapse-state stability.** The existing grouped-session collapse had a regression where live
   background metadata updates dropped grouping hints and flipped the collapse key (see CHANGELOG
   9.0.6 "Collapsing a session group … now works reliably"). Investigation parent rows must carry the
   same stable-key treatment or they will collapse-revert during an active recording.
4. **Notes/title affordance in the tree.** Inline rename/notes from the parent row, or rely on the
   existing commands? Recommendation: reuse the commands (right-click the parent row), no inline edit.

## Implementation pointers (when picked up)

- Data already exists: `InvestigationStore` (`src/modules/session/investigation-store.ts`) exposes
  `getAll()` + an `onDidChange` event; `resolveInvestigationMembers()` + `buildSessionKeyMap()` in
  `src/modules/session/investigation-resolve.ts` already join keys → live session metadata.
- Subscribe the webview session panel to `InvestigationStore.onDidChange` to re-render on edits.
- Thread an `investigations` payload through the host→webview session-list message (mirror how auto
  session-groups are sent) and render the parent rows in
  `src/ui/viewer-panels/viewer-session-panel-rendering*.ts`, reusing the existing group collapse JS.

## Out of scope (stays as-is)

- The command surface and the overview document — already shipped, do not rebuild.
- The shareable `reports/.investigations.json` persistence variant — a separate deferred follow-up;
  current persistence is workspaceState (private, per-workspace).
