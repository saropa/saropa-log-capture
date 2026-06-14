# Deferred — Crashlytics regression / new-issue false positives at the top-N paging boundary

Status: Deferred (blocked on an API capability, not on effort)
Source: split out of the codebase audit (`plans/history/2026.06/2026.06.14/104_plan-codebase-audit-2026-06-12.md`,
finding D3) when the audit's other deferred items (D1, D2, D4, D5) were built on 2026-06-14.

## The problem

`src/modules/crashlytics/crashlytics-issue-signals.ts` (`detectRegressedIds`, `newSinceLastSnapshot`)

The "Regressed" and "new issue" signals compare the current snapshot of Crashlytics issues against the
previous snapshot. Each snapshot holds only the **fetched top-N issues** and does not record whether
that page was truncated. So when an issue crosses the tracked top-N boundary — drops below the cutoff,
then later returns — it looks identical to a true stop-and-restart:

- An issue that falls out of the top-N then re-enters reads as a false "Regressed".
- An issue that re-enters after having been evicted reads as a false "new issue".

There is no per-snapshot signal that says "the list was truncated, so absence may be a paging artifact
rather than a genuine disappearance."

## Shipped mitigation (already in place — this is the deferred *true* fix)

- The "Regressed" badge tooltip states the caveat (`viewer.crashlytics.badge.regressedTip`).
- Both derivation paths (`detectRegressedIds`, `newSinceLastSnapshot`) carry a KNOWN LIMITATION comment.

## Why it stays deferred (the blocker)

A correct fix needs the read path to expose one of:

1. an **unpaged issue feed** (so a snapshot can hold every issue, making absence unambiguous), or
2. a **total count / truncation flag** alongside the top-N page (so the code can treat absence from a
   truncated page as "unknown" rather than "disappeared").

The current Crashlytics read path exposes neither. Until the upstream API (or the chosen read route)
provides a truncation/total signal or an unpaged listing, the false-positive cannot be distinguished
from the real event — the limitation is inherent to comparing two truncated top-N pages.

## When to revisit

Pick this up if/when the Crashlytics read integration gains a total-count or truncation field, or an
unpaged issue listing. At that point: record truncation state on each snapshot, and in both detectors
treat an issue's absence from a known-truncated page as indeterminate instead of as a disappearance.
