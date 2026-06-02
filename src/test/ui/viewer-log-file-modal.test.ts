/**
 * Log file actions modal: footer filename opens a dialog with copy + open actions.
 *
 * History: original modal only had editor / folder / copy-path. Expanded
 * 2026-06 to show the filename and add Copy filename, Copy relative path,
 * Open beside, Reveal in Explorer view, and Open folder in terminal.
 */
import * as assert from "node:assert";
import { getLogFileModalHtml, getLogFileModalScript } from "../../ui/viewer/viewer-log-file-modal";

suite("viewer-log-file-modal", () => {
    test("HTML includes modal shell and the filename display", () => {
        const html = getLogFileModalHtml();
        assert.ok(html.includes('id="log-file-modal"'), "modal root");
        assert.ok(html.includes('id="log-file-modal-filename"'), "filename display");
    });

    test("HTML includes all copy buttons in order, with the new labels", () => {
        const html = getLogFileModalHtml();
        assert.ok(html.includes('id="log-file-btn-copy-name"'), "copy filename");
        assert.ok(html.includes('id="log-file-btn-copy-rel"'), "copy relative path");
        assert.ok(html.includes('id="log-file-btn-copy-path"'), "copy full path");
        const nameIdx = html.indexOf('id="log-file-btn-copy-name"');
        const relIdx = html.indexOf('id="log-file-btn-copy-rel"');
        const fullIdx = html.indexOf('id="log-file-btn-copy-path"');
        assert.ok(nameIdx < relIdx && relIdx < fullIdx, "copy buttons appear in order");
    });

    test("HTML places a divider between the copy and open groups", () => {
        const html = getLogFileModalHtml();
        const dividerIdx = html.indexOf('log-file-modal-divider');
        const copyFullIdx = html.indexOf('id="log-file-btn-copy-path"');
        const openEditorIdx = html.indexOf('id="log-file-btn-open-editor"');
        assert.ok(dividerIdx > copyFullIdx, "divider comes after the last copy button");
        assert.ok(dividerIdx < openEditorIdx, "divider comes before the first open button");
    });

    test("HTML includes all open buttons (editor, beside, folder, explorer, terminal)", () => {
        const html = getLogFileModalHtml();
        assert.ok(html.includes('id="log-file-btn-open-editor"'), "open in editor");
        assert.ok(html.includes('id="log-file-btn-open-beside"'), "open beside");
        assert.ok(html.includes('id="log-file-btn-open-folder"'), "open containing folder");
        assert.ok(html.includes('id="log-file-btn-reveal-explorer"'), "reveal in Explorer view");
        assert.ok(html.includes('id="log-file-btn-open-terminal"'), "open folder in terminal");
    });

    test("script wires postMessage types the extension host handles", () => {
        const s = getLogFileModalScript();
        assert.ok(s.includes("openLogFileInEditor"), "openLogFileInEditor");
        assert.ok(s.includes("openLogFileBeside"), "openLogFileBeside");
        assert.ok(s.includes("openCurrentFileFolder"), "openCurrentFileFolder");
        assert.ok(s.includes("revealLogFileInExplorer"), "revealLogFileInExplorer");
        assert.ok(s.includes("openLogFileFolderInTerminal"), "openLogFileFolderInTerminal");
        assert.ok(s.includes("copyCurrentFilePath"), "copyCurrentFilePath");
        assert.ok(s.includes("copyCurrentFileName"), "copyCurrentFileName");
        assert.ok(s.includes("copyCurrentFileRelativePath"), "copyCurrentFileRelativePath");
    });

    test("script refreshes filename from the footer at open time", () => {
        const s = getLogFileModalScript();
        assert.ok(s.includes("refreshFilename"), "refreshFilename helper");
        assert.ok(s.includes("'.footer-filename'"), "reads from .footer-filename");
    });

    test("script exposes global for keyboard shortcut (revealFile)", () => {
        assert.ok(
            getLogFileModalScript().includes("window.openLogFileActionsModal"),
            "keybinding handler can open the same modal",
        );
    });
});
