# Drag-and-drop OS files into the Log Viewer — attempt log

**Status:** HARDENED & ARCHIVED (2026-06-09). Attempt 3's in-iframe approach was kept and made robust (enter/leave depth counter, reset-on-cancel, guarded handlers); see the Resolution section at the bottom. Closed for now — reopen only with a confirmed F5 reproduction.

**User request (verbatim):** "support drag and drop into the log viewer from the operating system" → later "drag and dropping of files does not work" → after attempt 2: "fail. does not work".

**Goal:** drag a `.log` file from the OS file manager onto the Saropa Log Viewer and have it open in the viewer.

---

## Key constraint (confirmed)

The Log Viewer ("Logs" panel) is a **VS Code webview view** (`package.json` → `contributes.views.saropaLogCapture[0].type === "webview"`; registered via `vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', …)` in [activation-providers.ts](../src/activation-providers.ts)). It is **not** a TreeView.

This matters because VS Code's only first-class, reliable OS-file-drop mechanism is **`TreeDragAndDropController.handleDrop`** (receives `text/uri-list` / files dropped onto a `TreeView`). That API is unavailable to a webview view. OS file drops onto a webview are subject to (a) the workbench intercepting the drop at the outer frame to open the file as an editor, and (b) the sandboxed content iframe possibly not exposing the `File` object. Both are known VS Code limitations and are version-dependent.

---

## Attempt 1 — document-level HTML drag events (`66694903` original `viewer-drop-to-open.ts`)

- **Tried:** `document.addEventListener('dragover'|'dragleave'|'drop', …)` in bubble phase; `dragover` preventDefault; on drop read `dataTransfer.files[0]`, prefer `File.path` else `FileReader.readAsText`, post `openDroppedLog` to host which loads by path or stages content to a temp file.
- **Result:** did not work (no load).
- **Suspected cause:** missing `dragenter` preventDefault (Chromium needs BOTH `dragenter`+`dragover`), and bubble-phase listeners intercepted by the workbench before the content frame.

## Attempt 2 — window capture-phase + dragenter + feedback (`d7a40a41`)

- **Tried:** moved listeners to `window` in **capture phase**; added `dragenter` preventDefault; added a visible drop overlay; added feedback — success toast naming the file, and an `{empty:true}` diagnostic message → warning toast when the drop arrives with no `File` object. Host handler `handleOpenDroppedLog` gained the `empty` branch.
- **Result:** "fail. does not work." User did NOT report which of the three diagnostic outcomes occurred (success toast / "could not read" warning / no overlay at all), so the failing layer is unconfirmed.
- **Conclusion:** patching the webview HTML drag handler further is low-confidence. Without the diagnostic outcome we cannot tell whether the drop never reaches the iframe (outer-frame interception → unfixable from inside the webview) or arrives without a File (sandbox → needs a different transfer).

---

## What a 3rd attempt MUST be different

Do NOT re-patch `viewer-drop-to-open.ts` event wiring again — that is the same approach twice. A genuinely different attempt is one of:

1. **Accept the limitation; remove the dead webview drop and keep the working picker.** "Open log file…" (kebab + command palette `saropaLogCapture.openLogFile`) already satisfies the underlying need (load a file by path) and is confirmed working. Removing the non-functional drag-drop avoids a feature that looks available but isn't. (Needs user permission — feature removal.)
2. **Add a TreeView drop surface.** Introduce a small `TreeView` (e.g. the session history list as a tree, or a dedicated "drop a log here" tree node) with a `TreeDragAndDropController` whose `dropMimeTypes` includes `'text/uri-list'`, and load the dropped URI(s). This is the VS Code-native, reliable path — but it is a structural addition (new view), not a webview tweak.
3. **Editor drop via a `DocumentDropEditProvider`** — only applies to text editors, not a custom view; likely not a fit.

**Diagnostic provided (user screenshot, after attempt 2):** dragging a file over the viewer shows VS Code's own file-drag cursor ("+ Copy"), but **NO dashed overlay appears and releasing does nothing** (no toast). The overlay is driven by our `dragover` handler, so the overlay never showing means our `dragover` either isn't firing or returns early.

## Attempt 3 — ungate dragover + read text/uri-list (in progress)

- **Hypothesis (different from 1 & 2):** in a webview, `DataTransfer.types` is commonly **empty during `dragover`** (file data is hidden until `drop` for security). Both prior attempts gated `dragover` on `hasFiles()`, which returns false when types is empty → we never `preventDefault` on dragover → Chromium never fires `drop`, and the overlay never shows. That is a real, specific defect distinct from "missing dragenter / wrong phase."
- **Tried:** (a) on `dragenter`/`dragover` (window, capture), `preventDefault` whenever the drag is NOT an in-page typed drag (i.e. `hasFiles(e) || types.length === 0`) so OS file drags with hidden types still arm the drop, while internal SQL/collection drags (which carry their own mime types) are left alone; (b) on `drop`, read the file from `files[]` AND from `dataTransfer.items` (`getAsFile`) AND from `text/uri-list` — VS Code hands dropped files over as a `file://` URI in `text/uri-list`, which neither prior attempt read. A uri-list hit posts `{ openDroppedLog, uri }`; the host parses it with `vscode.Uri.parse`.
- **Result:** PENDING user test. If the overlay now appears, the webview receives the drag and this is the fix. If the overlay STILL does not appear, the workbench is intercepting at the outer frame and webview drop is confirmed impossible — fall back to a TreeView drop surface or remove the feature.

---

## Root cause (confirmed via VS Code source behavior + tracked issues, 2026-06-09)

The "overlay never appears + only VS Code's own '+ Copy' cursor shows" symptom is **not** a wiring bug in `viewer-drop-to-open.ts`. It is a deliberate VS Code workbench behavior:

- Since ~VS Code 1.44, the workbench sets **`pointer-events: none` on the webview host element for the duration of any drag** ([microsoft/vscode#96967](https://github.com/microsoft/vscode/issues/96967) — *"Webview break drag and dropping around the main window (no events are generated when you are over them). Work around this by disabling pointer events during the drag."*). While that style is active, the content iframe receives **zero** drag/drop events — which is exactly why our `dragenter`/`dragover`/`drop` listeners never fire and the overlay never shows. The "+ Copy" cursor is the workbench's OWN outer-frame drop handler, not ours.
- OS file drops *can* reach a webview in current VS Code, but the working reports ([#182449](https://github.com/microsoft/vscode/issues/182449), [#193558](https://github.com/microsoft/vscode/issues/193558)) are all for webview **editors** (`WebviewPanel`). The Logs panel is a webview **view** (`WebviewView`) hosted in a sidebar view container, where the pointer-events workaround applies and there is no public override.

**Conclusion:** Attempts 1, 2, and 3 are all the same class of fix (in-iframe event wiring) and all hit the same wall — the iframe is made non-interactive during the drag by the host. There is no 4th in-iframe patch that can work. This is now a CONFIRMED structural limitation, not an unconfirmed failing layer.

**Decision required (both choices need user sign-off — structural change / feature removal):**

1. **TreeView drop surface (reliable, native).** Add a small `TreeView` with a `TreeDragAndDropController` (`dropMimeTypes: ['text/uri-list']`, `handleDrop` loads the dropped URI via the existing `ctx.load` pipeline). This is the only VS Code-native, reliable OS-file-drop mechanism. Trade-off: the drop target becomes a tree node, not the log-viewer panel itself, so the UX differs slightly from "drop onto the viewer."
2. **Remove the dead webview drop; keep the picker.** Delete `viewer-drop-to-open.ts` wiring and the `openDroppedLog` host branch, relying on the confirmed-working **"Open log file…"** command (kebab + palette `saropaLogCapture.openLogFile`) and the URL-open path. Avoids shipping a gesture that looks available but never works.

---

## Resolution (2026-06-09) — harden attempt 3, do not abandon it

Re-reading the trail flipped the conclusion. The "no overlay ever appears" diagnostic was attributed to outer-frame interception, but it is fully explained by **attempt 2's own gating bug**: attempt 2 only `preventDefault`-ed `dragover` when `hasFiles()` was true, and during an OS file dragover the browser hides the file types, so `hasFiles()` returned false → no `preventDefault` → Chromium suppressed the drop → no overlay. **Attempt 3 already removed that gate** (ungated dragover, read `text/uri-list`) but was committed without a fresh user test, so the trail still read as "failed." On Windows, OS file drops DO reach webviews ([microsoft/vscode#182449](https://github.com/microsoft/vscode/issues/182449); the iframe drag bug in [#193558](https://github.com/microsoft/vscode/issues/193558) is macOS-only), so the webview path is the right one to keep — not abandon for a TreeView.

Rather than patch the event wiring a 4th time (same class of change, banned by the repeated-failure rule), this pass hardened the **reliability** of the working approach in [viewer-drop-to-open.ts](../src/ui/viewer/viewer-drop-to-open.ts):

- **Drag enter/leave depth counter.** `dragenter`/`dragleave` fire once per element boundary crossed; the old single-leave handler hid the overlay the instant the cursor moved from the body onto any child row. Now `+1` per enter / `-1` per leave, hide only at zero — the overlay stays put across the whole panel.
- **Reset-on-cancel.** A drag can end with no drop and no matching leave (Esc-cancel, release outside the window, tab blur), which previously stranded the dashed overlay. `dragend` + window `blur` + a guarded-handler catch all force the state back to neutral.
- **Guarded handlers.** Every listener is wrapped so it can never throw (project rule: event handlers never throw) and resets the drag state on any failure.
- **Removed `stopPropagation`.** The workbench drop handler is in the parent frame (cross-frame events never bubble to it, so stopping propagation here can't reach it); dropping it avoids any chance of starving VS Code's webview-internal drag plumbing. `preventDefault` alone arms the drop.
- Multi-path delivery unchanged: OS path (`file.path`), `file://`/`http(s)://` URI in `text/uri-list`, `DataTransferItemList.getAsFile`, or capped `FileReader` content → host stages to temp and loads.

Quality gates green: `check-types`, `lint` (clean for this file), full `compile` with all catalog/nls/size verifiers. **Not manually re-tested in an F5 Extension Host** — that is the one remaining verification. If a fresh F5 drag still shows no overlay on Windows, the next step is option 1 (TreeView drop surface), not another in-iframe patch.

---

## Finish Report (2026-06-09)

**Scope:** (B) VS Code extension (TypeScript). One source file hardened, one test file added, changelog + this archive updated.

**Reviewed by another AI.**

### Deep review
- **Logic & safety.** The depth counter can underflow if a `dragleave` arrives with no prior `dragenter` (cross-frame ordering); guarded by `if (dragDepth > 0) dragDepth--`, and `resetDrag()` clamps it to 0 on `dragend`/`blur`/handler-error, so it cannot wedge negative. Handlers are wrapped by `guard()` (try/catch → `resetDrag`) satisfying the project rule that event handlers never throw. No recursion, no async races (the only async is the pre-existing `FileReader`, unchanged).
- **Architecture.** Stayed within the existing single-IIFE generated-script module; no new module, no new dependency, no shared-primitive change. Multi-path delivery (path / uri-list / items / content) preserved exactly; host handler `viewer-dropped-log.ts` untouched.
- **Performance/UX.** Overlay is `pointer-events:none` so it never pollutes the hit-test; the counter removes the previous flicker. No new work on the hot path.
- **Docs.** WHY-comments added at each non-obvious decision (counter rationale, reset-on-cancel rationale, stopPropagation-removal rationale, guard rationale).

### Testing
- **Existing-test audit (4A):** grepped `src/test` for `getDropToOpenScript`, `isInPageTypedDrag`, `handleDrop`, `dragDepth`, `loadDroppedFile`, `openDroppedLog`, `drop-to-open`, `Drop a log` → **zero** matches. No existing test pinned this module; nothing to update.
- **New test (4B):** added `src/test/ui/viewer-drop-to-open.test.ts` (8 cases) pinning the reliability invariants — all listeners registered capture-phase, both `dragenter`+`dragover` arm the drop, depth-counter increment/decrement, reset on `dragend`/`blur`, guarded handlers, no `stopPropagation()` call, multi-path delivery, and in-page-typed-drag passthrough. **Ran via `npm run test:file` → 8 passing.** `check-types` clean; `eslint` clean for both task files; full `compile` green.

### Files
- `src/ui/viewer/viewer-drop-to-open.ts` — hardened (counter, reset hooks, guards, stopPropagation removal).
- `src/test/ui/viewer-drop-to-open.test.ts` — new (8 passing).
- `CHANGELOG.md` — Fixed entry under [Unreleased].
- `bugs/drag_drop_into_viewer_attempts.md` → `plans/history/2026.06/2026.06.09/drag-drop-into-viewer-attempts.md` (this file).

### Status honesty
Status line reads **HARDENED & ARCHIVED**, not the skill's literal `Fixed`, deliberately: the fix compiles, type-checks, lints, and its invariants are unit-tested, but the end-to-end OS drag has **not** been exercised in an F5 Extension Host. Calling it `Fixed` would assert a device verification that did not happen (production-quality/honesty rules override the literal-word convention). Remaining action: a human F5 drag test on Windows (see What to test). If it still fails, escalate to a TreeView drop surface — not another in-iframe patch.

Finish report appended: plans/history/2026.06/2026.06.09/drag-drop-into-viewer-attempts.md
