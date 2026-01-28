# Plan: Restructure extension.ts for Modularity

## Goals
- Move non-activation, non-registration logic out of extension.ts
- Improve maintainability and testability
- Align with project modular conventions

## Steps

1. **Audit extension.ts**
   - List all functions and logic blocks
   - Identify which are VS Code activation/registration only
   - Mark candidates for extraction (utility, session, log, UI, etc.)

2. **Map functions to modules**
   - Log/session logic → `src/modules/log-session.ts`, `session-manager.ts`
   - Output event/tracking → `src/modules/tracker.ts`, `deduplication.ts`
   - Export/formatting → `src/modules/export-formats.ts`
   - UI/Sidebar logic → `src/ui/log-viewer-provider.ts`, `viewer-*.ts`
   - Status bar/context menu → `src/ui/status-bar.ts`, `viewer-context-menu.ts`

3. **Refactor**
   - Move function implementations to modules
   - Export/import as needed
   - Update extension.ts to use new imports
   - Keep extension.ts ≤300 lines, focused on activation/registration

4. **Test**
   - Run build, lint, and tests
   - Validate extension activation and all commands

5. **Document**
   - Update README.md and CLAUDE.md if module boundaries or APIs change

## Notes
- Follow project conventions: clarity over cleverness, ≤30 line functions, ≤4 params, ≤3 nesting
- Prefer deletion over abstraction if code is unused
- See copilot-instructions.md for module patterns

---

_This plan will guide the modularization of extension.ts for Saropa Log Capture._
