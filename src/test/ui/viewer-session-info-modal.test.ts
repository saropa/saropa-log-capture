/**
 * Session info modal: (i) icon next to the filename opens a structured view of
 * the SAROPA LOG CAPTURE header. Pins shell structure, message-type contracts,
 * grouping behavior, and hotlink emission so the modal's wire-format does not
 * drift silently from the host-side handlers.
 */
import * as assert from "node:assert";
import { getSessionInfoModalHtml, getSessionInfoModalScript } from "../../ui/viewer/viewer-session-info-modal";
import { getSessionInfoRenderScript } from "../../ui/viewer/viewer-session-info-modal-render";
import { getToolbarHtml } from "../../ui/viewer-toolbar/viewer-toolbar-html";

suite("viewer-session-info-modal", () => {
    test("HTML includes modal shell, content root, and copy hint", () => {
        const html = getSessionInfoModalHtml();
        assert.ok(html.includes('id="session-info-modal"'), "modal root");
        assert.ok(html.includes('id="session-info-modal-content-root"'), "content root");
        assert.ok(html.includes('class="session-info-hint"'), "copy hint banner");
        assert.ok(html.includes('session-info-modal-content'), "scoped width class is applied to modal-content");
    });

    test("toolbar exposes the (i) info button in toolbar-right, hidden by default", () => {
        const html = getToolbarHtml({ version: "1.0.0" });
        assert.ok(html.includes('id="session-info-btn"'), "info button id");
        assert.ok(html.includes("codicon-info"), "uses codicon-info glyph");
        const btnIdx = html.indexOf('id="session-info-btn"');
        const rightIdx = html.indexOf('toolbar-right');
        const filenameIdx = html.indexOf('toolbar-filename');
        assert.ok(btnIdx > rightIdx && btnIdx < filenameIdx, "info button sits between toolbar-right marker and the filename");
        /* Hidden by default — only visible after setSessionHeaderLines arrives with a non-empty list. */
        const buttonOpenIdx = html.indexOf('<button', btnIdx - 200);
        const buttonCloseIdx = html.indexOf('>', btnIdx);
        const buttonOpenTag = html.slice(buttonOpenIdx, buttonCloseIdx + 1);
        assert.ok(/style="display:\s*none"/i.test(buttonOpenTag), "info button hidden by default");
    });

    test("script wires open/close, escape, and exposes the global opener", () => {
        const s = getSessionInfoModalScript();
        assert.ok(s.includes("window.openSessionInfoModal"), "global opener so keybindings can fire it");
        assert.ok(s.includes("'Escape'"), "Escape closes the modal");
        assert.ok(s.includes("modal-close"), "close button is wired");
    });

    test("script publishes the apply hook on window so message handler can call it", () => {
        const s = getSessionInfoModalScript();
        assert.ok(s.includes("window.__applySessionHeaderLines"), "exposes apply hook");
        assert.ok(s.includes("window.__sessionHeaderLines"), "stashes header lines on window");
        assert.ok(s.includes("setInfoBtnVisible"), "toggles the toolbar button visibility");
    });

    test("script implements long-press to copy a row", () => {
        const s = getSessionInfoModalScript();
        assert.ok(s.includes("LONG_PRESS_MS"), "long-press timer constant");
        assert.ok(s.includes("data-copyable"), "rows opt-in via data-copyable");
        assert.ok(s.includes("data-copytext"), "copy payload lives on data-copytext");
        assert.ok(s.includes("copyToClipboard"), "uses the shared copyToClipboard host action");
        assert.ok(s.includes("showCopyToast"), "shows the shared copy toast");
    });

    test("script emits openUrl for URL hotlinks and revealPath for path hotlinks", () => {
        const s = getSessionInfoModalScript();
        /* openUrl is already validated host-side; revealPath is the new handler
           added for launch.json path values. */
        assert.ok(s.includes("'openUrl'"), "URL hotlinks dispatch openUrl");
        assert.ok(s.includes("'revealPath'"), "path hotlinks dispatch revealPath");
    });

    test("render script defines parse / group / render under a single window hook", () => {
        const s = getSessionInfoRenderScript();
        assert.ok(s.includes("parseHeaderRecords"), "parser present");
        assert.ok(s.includes("groupRecords"), "grouper present");
        assert.ok(s.includes("window.__renderSessionInfo"), "single render entry point on window");
    });

    test("render script defines the six structured sections in order", () => {
        const s = getSessionInfoRenderScript();
        const expected = [
            "viewer.sessionInfo.section.session",
            "viewer.sessionInfo.section.launch",
            "viewer.sessionInfo.section.environment",
            "viewer.sessionInfo.section.git",
            "viewer.sessionInfo.section.system",
            "viewer.sessionInfo.section.integrations",
        ];
        let lastIdx = -1;
        for (const key of expected) {
            const idx = s.indexOf(key);
            assert.ok(idx > lastIdx, `section ${key} should appear after the previous one`);
            lastIdx = idx;
        }
    });

    test("render script recognizes launch-config path keys for reveal-path hotlinks", () => {
        const s = getSessionInfoRenderScript();
        /* These are the launch.json sub-keys that get the OS-reveal affordance.
           If a project adds a new launch key that should also be a reveal target,
           extend PATH_KEYS and this test together. */
        for (const k of ["program", "cwd", "projectRootPath", "flutterSdkPath", "dartSdkPath"]) {
            assert.ok(s.includes(k + ": 1"), `PATH_KEYS should include ${k}`);
        }
    });

    test("render script folds the long Uncommitted line behind a details/summary", () => {
        const s = getSessionInfoRenderScript();
        assert.ok(s.includes("renderUncommittedRow"), "uncommitted-row branch present");
        /* The trigger is the literal ' — ' separator combined with the trailing
           '(+N more)' suffix written by environment-collector. If that format
           changes, the fold-out collapses to a plain row instead. */
        assert.ok(s.includes("' — '"), "checks for the em-dash separator");
        assert.ok(s.includes("(\\+\\d+ more\\)$"), "checks for the (+N more) trailer");
    });
});
