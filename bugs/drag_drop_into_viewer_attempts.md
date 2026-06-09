# Drag-and-drop OS files into the Log Viewer — attempt log

**Status:** NOT WORKING — 2 attempts failed. Paused per the "stop after repeated failures, document first" rule.

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
