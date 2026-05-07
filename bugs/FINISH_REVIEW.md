
1. CRITICAL NOTE: This work will be reviewed by another AI.

2. Scope (mandatory, first): State whether this change set touches (B) VS Code extension (extension/, TypeScript), or (C) docs/scripts only. Every numbered section below must be executed or explicitly marked SKIPPED [Reason Code] — out of scope with a one-line reason tied to (B) or (C).

3. Deep Review: Review only the files with code changes for the following:
   * Logic & Safety: Check for logic issues, race conditions, and recursion risks.
   * Architecture & Adherence: Ensure project framework compliance, consistency, and modularity. Check for logic duplication and shared utility opportunities.
   * Linter-Specific Integrity: SKIPPED [A-NOT-IN-SCOPE].
   * Performance & UI/UX: Assess performance risks. Consider background processing, parallelism, and clear loading/progress feedback. Verify "Error Boundary" behavior and ensure the UI remains stable if background processes fail.
   * Documentation Quality: Write concise, clear code comments where non-obvious; add or extend a verbose module/file doc header for developers when introducing or centralizing behavior.
   * Refactoring: If there are opportunities to improve the code or remove code smells beyond the requested scope, STOP and report.

4. Testing Validation:
   * Write or extend extension npm test / TS tests in the same stack as the changed code.
   * Add cases so before vs after behavior is explicit.
   * Examples & template: SKIPPED [A-NOT-IN-SCOPE].

5. Project Maintenance & Tracking:
   * Update CHANGELOG when behavior visible to users changes.
   * Update README if this task changes product facts; if unchanged, state README verified — no updates needed.
   * Update package.json / package-lock.json only if this task includes a release or dependency change.
   * Update TODOs, plans, and other tracking docs when this task implements or closes them.
   * Review doc/guides/ for compatibility; if nothing user-facing changed, state guides reviewed.
   * Roadmap: SKIPPED [A-NOT-IN-SCOPE].
   * If there is a related bug report, update it and move it to plan/history/yyyymmdd/ only if fully implemented.

6. Commit & Finalization:
   * Git commit only the files that belong to this task once tests pass.
   * List all files changed and all plans/bug files created, updated, or moved.
   * Provide a concise diff summary of core logic changes for the Reviewer AI.
   * State task scope and any outstanding work.
   * End with, in large heading form: # TASK IS COMPLETE
   

