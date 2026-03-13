# Feature Cohesion & Intelligence Plans

This index tracks plans for improving feature cohesion and adding intelligence — making the extension feel like a unified, smart whole rather than a sum of separate parts.

## Problem Summary

| # | Problem | Current State |
|---|---------|---------------|
| 1 | **No Unified Timeline** | Debug Console, terminal, integrations viewed separately |
| 2 | **Integration Adapters Are Islands** | No correlation between perf spike and timeout error |
| 3 | **Session ≠ Investigation** | Can't bundle evidence spanning multiple sessions |
| 4 | **Search Is Siloed** | Find-in-files only searches logs, not sidecars |

## Quick Wins (Completed)

Implemented in commit `645be25` (*feat: Integration cohesion quick wins*):

| Feature | What it does |
|---------|--------------|
| Timestamp correlation | All integration meta includes `capturedAt` and `sessionWindow` |
| Show Integration Context | Context menu item shows all integration data for session |
| SLC sidecar bundling | Export/import includes integration sidecar files |

---

## Tier 6: Cohesion Plans

| # | Plan | Solves | Effort | Status |
|---|------|--------|--------|--------|
| [020](history/20260312/020_plan-unified-timeline-view.md) | **Unified Timeline View** | Problems 1, 2 | High (7-10 days) | Planned |
| [021](history/20260312/021_plan-investigation-mode.md) | **Investigation Mode** | Problems 3, 4 | Medium (8-12 days) | ✅ Complete |
| [022](history/20260312/022_plan-context-popover.md) | **Context Popover** | Problems 1, 2 (partial) | Low (4-7 days) | Planned |

---

## Tier 7: Intelligence Plans

Requires Tier 6 (Cohesion) as foundation.

| # | Plan | Solves | Description | Effort | Status |
|---|------|--------|-------------|--------|--------|
| [023](023_plan-ai-explain-error.md) | **AI Explain Error** | 2, 3, 4 | Right-click → Explain with AI | Medium (5-8 days) | Planned |
| [024](024_plan-auto-correlation.md) | **Auto-Correlation** | 1, 2 | Detect related events automatically | High (10-14 days) | ✅ Implemented |
| [025](025_plan-noise-learning.md) | **Noise Learning** | 1, 4 | Learn from dismissals, suggest filters | High (10-14 days) | Planned |
| [026](026_plan-share-investigation.md) | **Share Investigation** | 3 | Generate shareable URL for investigation | Medium (9-13 days) | Planned |

---

## Recommended Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 6: COHESION                             │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: Context Popover (4-7 days)                             │
│          └── Delivers immediate value, builds infrastructure    │
│                              ↓                                  │
│ Phase 2: Investigation Mode (8-12 days)                         │
│          └── Cross-session problem, unified search              │
│                              ↓                                  │
│ Phase 3: Unified Timeline (7-10 days)                           │
│          └── Full correlation visualization                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  TIER 7: INTELLIGENCE                           │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: AI Explain Error (5-8 days)                            │
│          └── Quick win, Context Popover provides data for AI    │
│                              ↓                                  │
│ Phase 5: Auto-Correlation (10-14 days)                          │
│          └── Timeline has events, add pattern matching          │
│                              ↓                                  │
│ Phase 6: Noise Learning (10-14 days)                            │
│          └── Track interactions, suggest filters                │
│                              ↓                                  │
│ Phase 7: Share Investigation (9-13 days)                        │
│          └── Investigation Mode has model, add sharing          │
└─────────────────────────────────────────────────────────────────┘
```

**Total estimated effort:** 55-78 days (Tier 6 + Tier 7). Sum of phase ranges; phases are sequential so no overlap.

---

## Shared Infrastructure

These plans share common infrastructure that should be built once:

| Component | Used by | Location |
|-----------|---------|----------|
| Timestamp parser | All | `src/modules/timeline/timestamp-parser.ts` |
| Sidecar loader | Context Popover, Timeline | `src/modules/context/context-loader.ts` |
| TimelineEvent model | Timeline, Investigation, Correlation | `src/modules/timeline/timeline-event.ts` |
| findSidecarUris | Already exists | `src/modules/export/slc-bundle.ts` |
| AI context builder | AI Explain, future AI features | `src/modules/ai/ai-context-builder.ts` |
| Interaction tracker | Noise Learning | `src/modules/learning/interaction-tracker.ts` |

---

## The Vision

After all plans are implemented:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Saropa Log Capture                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Capture   │  │  Correlate  │  │   Assist    │             │
│  │   (today)   │→ │  (Tier 6)   │→ │  (Tier 7)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  "Never lose       "What happened    "Why did this            │
│   debug output"     together?"        happen?"                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Metrics

Track success via the table below. Requires product analytics (implement events as plans ship).

| Tier | Metric | Target |
|------|--------|--------|
| Cohesion | % users viewing Timeline | 30%+ of active users |
| Cohesion | Investigations created | 1+ per power user per week |
| Intelligence | AI explanations requested | 10+ per user per week |
| Intelligence | Correlation badges clicked | 50%+ click-through |
| Intelligence | Suggested filters accepted | 60%+ acceptance rate |
| Intelligence | Investigations shared | 5%+ of investigations |

---

*Created: 2026-03-12*
*Last updated: 2026-03-12*

**Review (2026-03-12):** Phase 3/4 implementation (investigation export/import, bug report context, session panel investigations, replay bar, Git blame/commit links) reviewed. Fixes applied: investigation-only report footer, import rollback on addSource failure, v3 manifest and investigation-context tests, status bar loading until final message, replay defer comment. No blocking issues; tests pass.
