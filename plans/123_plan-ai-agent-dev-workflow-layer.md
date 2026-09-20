# PLAN 123 — Minimal AI-agent dev-workflow layer for this repo (CLAUDE.md + narrow subagents)

**Status: Open**

Created: 2026-09-20
Type: Tooling / Infrastructure
Related: `CONTRIBUTING.md`, `ARCHITECTURE.md`, `plans/guides/ecosystem-knowledge-files.md`, `plans/guides/style-guide.md`

---

## Summary

Add a small `CLAUDE.md` documenting this repo's architecture invariants for AI-agent
consumption, plus 2–3 narrow, single-purpose subagent definitions (`.claude/agents/`)
for the highest-leverage recurring tasks — starting with a reviewer and a
release-readiness checker — rather than a full multi-agent SDLC pipeline.

---

## Motivation

Comparative research against `flutter_inspector_kit` verified (by reading all 14
`.claude/agents/*.md` files, not just their names) a genuinely distinct multi-agent
software-development pipeline: planner → sdd-planner → interface-designer →
implementer → verifier/reviewer → brancher/publisher → responder, each with a
different model tier, tool allowlist, and write scope, wired together via
`.agents/hooks.json` stage-gating. Their `CLAUDE.md` documents hard architecture
invariants (ring-buffer mutation rules, no-defensive-copy timeline merge, etc.)
specifically for agent consumption, separate from their human-facing
`best_practices.md`.

Saropa-log-capture has **no equivalent** — confirmed no `.claude/`, `.agents/`, or
`AGENTS.md` anywhere in the repo. `CONTRIBUTING.md` (420 lines) is thorough but
entirely human-oriented: commit hooks, terminology standards, code-style limits,
JSDoc conventions, test/build commands, marketplace publishing steps.

This is a real gap in the team's own tooling, separate from the product comparison.
But this repo already has unusually strong process discipline to build on: 373 files
under `plans/`, a numbered plan/bug convention with strict rules
(`bugs/ISSUE_REPORT_GUIDE.md`), a `MASTER_PLAN.md` P0/P1 backlog, and a real CI
pipeline with 9+ custom verify scripts. A full 14-agent pipeline would be
disproportionate to adopt wholesale; a **minimal, high-leverage subset** captures
most of the value.

---

## Behavior

### User flow (repo-maintainer facing, not end-user facing)

1. A `CLAUDE.md` at repo root documents the invariants an agent must not violate
   when editing this codebase — the same category of guardrail this repo already
   half-documents informally across `ARCHITECTURE.md`, `CONTRIBUTING.md`'s pitfall
   table (`Common Pitfalls`, `ISSUE_REPORT_GUIDE.md:313-321`), and the
   `plans/guides/style-guide.md`.
2. Two or three `.claude/agents/*.md` definitions cover the narrowest, most
   repeated tasks:
   - **reviewer** — pre-commit/pre-PR review against this repo's own documented
     pitfalls (the `Common Pitfalls` table, the `Fix Requirements` checklist in
     `ISSUE_REPORT_GUIDE.md:325-356`) — this repo already has the review criteria
     written down, it just isn't wired to an agent role.
   - **release-checker** — report-only, checks the version-consistency rule this
     repo almost certainly has somewhere (CHANGELOG/package.json/README version
     alignment) before a release, mirroring inspector_kit's `release-checker.md`
     report-only pattern.
   - (optional third) **bug-report-triager** — given a raw user report, drafts a
     properly-formatted `bugs/bug_NNN_*.md` file following the exact template and
     numbering rule in `ISSUE_REPORT_GUIDE.md`, which is a mechanical, well-specified
     task well-suited to a narrow agent.

### UI / UX

N/A — internal dev tooling.

---

## Edge Cases

1. **CLAUDE.md duplicating existing docs** — do not restate what's already in
   `ARCHITECTURE.md`/`CONTRIBUTING.md`; per inspector_kit's own convention
   (`CLAUDE.md` explicitly says "do not merge or deduplicate with
   `best_practices.md`"), keep `CLAUDE.md` scoped to agent-specific invariants and
   pointers, not a restatement of the human contributor guide.
2. **Agent write scope** — the reviewer/release-checker agents should be
   report-only (no direct commits), consistent with how this repo already gates
   real changes through the plan/bug file process — don't let an agent bypass the
   numbered-file discipline that gives this repo its traceability.

---

## Alternatives Considered

- **Adopt the full 14-agent pipeline** — rejected as disproportionate: that pipeline
  exists because inspector_kit delegates actual implementation to an external MCP
  tool (Gemini/antigravity-cli) and needs heavy orchestration to coordinate parallel
  workers; this repo's contribution model doesn't currently need that scale.
- **Do nothing, rely on `CONTRIBUTING.md` alone** — rejected: it's human-oriented
  prose; an agent working in this repo currently has no equivalent of "these are the
  invariants you must not break," which increases the odds of a regression an agent
  introduces silently (e.g. reintroducing a bug from the `Common Pitfalls` table).

---

## Decision

<!-- Fill in when the proposal is accepted or declined -->

---

## Implementation Notes

- Draft `CLAUDE.md` by extracting invariants already scattered across
  `ARCHITECTURE.md` (data-flow pipeline: DebugAdapterTracker → SessionManager →
  LogSession → ViewerBroadcaster) and the `Common Pitfalls` table.
- Base the `reviewer` agent's checklist directly on `ISSUE_REPORT_GUIDE.md`'s
  existing `Fix Requirements` section — no new criteria need inventing.

---

## Commits

<!-- Add commit hashes as implementation lands -->
