/**
 * Log file actions modal: footer filename opens a dialog with editor / folder / copy path.
 * Before: footer used click=reveal viewer, long-press=copy path, double-click=open folder.
 * After: footer filename click and Ctrl+Shift+E open this modal; host handles `openLogFileInEditor`.
 */
import * as assert from "node:assert";
import { getLogFileModalHtml, getLogFileModalScript } from "../../ui/viewer/viewer-log-file-modal";

suite("viewer-log-file-modal", () => {
    test("HTML includes modal shell and the three action buttons", () => {
        const html = getLogFileModalHtml();
        assert.ok(html.includes('id="log-file-modal"'), "modal root");
        assert.ok(html.includes('id="log-file-btn-open-editor"'), "open in editor");
        assert.ok(html.includes('id="log-file-btn-open-folder"'), "open containing folder");
        assert.ok(html.includes('id="log-file-btn-copy-path"'), "copy path");
    });

    test("script wires postMessage types the extension host handles", () => {
        const s = getLogFileModalScript();
        assert.ok(s.includes("type: 'openLogFileInEditor'"), "openLogFileInEditor message");
        assert.ok(s.includes("type: 'openCurrentFileFolder'"), "openCurrentFileFolder message");
        assert.ok(s.includes("type: 'copyCurrentFilePath'"), "copyCurrentFilePath message");
    });

    test("script exposes global for keyboard shortcut (revealFile)", () => {
        assert.ok(
            getLogFileModalScript().includes("window.openLogFileActionsModal"),
            "keybinding handler can open the same modal",
        );
    });
});
