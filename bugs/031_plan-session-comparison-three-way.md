# Plan: Session comparison (3-way)

**Feature:** Compare three sessions side by side (e.g. diff-style or aligned by time) to see what changed between runs.

---

## What exists

- Session list and open session in viewer; possibly session comparison or diff elsewhere in codebase.
- Timeline and context popover for single-session view.
- Export/import of sessions and investigations.

## What's missing

1. **3-way session selection** — UI to pick three sessions (e.g. baseline, run A, run B) from the project logs or investigation.
2. **Comparison view** — Display the three logs in a comparable way: aligned by timestamp, or by line number, or side-by-side diff (e.g. baseline vs A, baseline vs B).
3. **Difference highlighting** — Highlight added/removed/changed lines or error sets between runs; optional summary (e.g. "Session B has 3 new errors vs baseline").

## Implementation

### 1. Selection

- Command or panel: "Compare 3 sessions"; user selects three sessions (list or picker). Store as Session A, B, C (or Baseline, A, B).
- Validate: all three are valid log URIs and readable.

### 2. Alignment strategy

- **By time:** Align lines by timestamp so the same moment in time lines up across columns. Gaps if one session has no event at that time.
- **By structure:** If logs share similar structure (e.g. same test run), align by line index or by first N lines; then diff.
- **By content:** Fuzzy match lines across sessions (e.g. same error message); more complex.

### 3. UI

- Three columns (or three panels); shared scroll or linked scroll. Use existing viewer components if possible, with a "comparison" mode that hides single-session chrome.
- Diff highlighting: color or icon for "only in A", "only in B", "only in C", "in all". Optional summary panel above/below.

### 4. Scope

- MVP: three columns, same log format; align by line index and show simple diff (add/remove). Later: timestamp alignment and richer summary.

## Files to create/modify

| File | Change |
|------|--------|
| New: comparison data (e.g. `src/modules/compare/session-compare.ts`) | Load three logs; align; compute diff |
| New: comparison view (e.g. `src/ui/panels/session-compare-panel.ts`) | Three-column UI; wire to comparison data |
| Commands | "Compare 3 sessions" → open comparison with session picker |
| `package.json` | Command, optional view container |

## Considerations

- Large logs: avoid loading three full logs into memory; stream or window.
- Different log lengths: define rules (e.g. align by start time, pad shorter with empty lines or "no event").

## Effort

**7–10 days** for 3-way view with timestamp or line alignment and basic diff.
