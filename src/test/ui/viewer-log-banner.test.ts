/**
 * Unified log banner (viewer-log-banner.ts, plan 109).
 *
 * Pins two fixes:
 *  - File actions must target the URI the banner is DISPLAYING (ctx.currentUri from
 *    logContextInfo), not the receiving target's host-side currentFileUri. The latter is
 *    only set for the live tail session, so in a popped-out panel a bare message resolved
 *    against an unset/stale URI and "Open in Editor" silently did nothing.
 *  - The banner's open/copy button labels read in title case.
 */
import * as assert from "node:assert";
import { getLogBannerScript } from "../../ui/viewer/viewer-log-banner";
import { stringsWebview } from "../../l10n/strings-webview";

suite("viewer-log-banner", () => {
    test("file actions carry the displayed URI so they don't depend on host currentFileUri", () => {
        const s = getLogBannerScript();
        // The fix: postCurrentFileAction attaches ctx.currentUri as uriString when present.
        assert.ok(s.includes("msg.uriString = ctx.currentUri"), "attaches displayed URI to the message");
        assert.ok(s.includes("openLogFileInEditor"), "wires the open-in-editor action");
        assert.ok(s.includes("copyCurrentFilePath"), "wires the copy-path action");
    });

    test("open-in-editor and copy-path are routed through postCurrentFileAction", () => {
        const s = getLogBannerScript();
        assert.ok(s.includes("postCurrentFileAction('openLogFileInEditor')"), "open-editor uses the URI-carrying helper");
        assert.ok(s.includes("postCurrentFileAction('copyCurrentFilePath')"), "copy-path uses the URI-carrying helper");
    });

    test("banner button labels are title case", () => {
        assert.strictEqual(stringsWebview["viewer.logFile.openEditor"], "Open in Editor");
        assert.strictEqual(stringsWebview["viewer.logFile.copyFullPath"], "Copy Full Path");
    });

    // The bar was a pop-up: every action, and any click on its body, called hideBanner(). Copying a
    // path or opening the file therefore closed the bar out from under the user. Only the × may.
    test("file actions leave the persistent bar standing", () => {
        const s = getLogBannerScript();
        assert.ok(
            s.includes("if (action === 'open-editor') { postCurrentFileAction('openLogFileInEditor'); return; }"),
            "open-editor must not hide the bar",
        );
        assert.ok(
            s.includes("if (action === 'copy-path') { postCurrentFileAction('copyCurrentFilePath'); return; }"),
            "copy-path must not hide the bar",
        );
        assert.ok(s.includes("if (action === 'hide') { hideBanner(); return; }"), "only the × hides the bar");
    });

    // Re-rendering the bar on every logContextInfo would re-announce an aria-live region and rebuild
    // buttons under the cursor; the host re-posts that message continuously during a live capture.
    test("status renders are idempotent — no DOM writes when nothing changed", () => {
        const s = getLogBannerScript();
        assert.ok(s.includes("var wasStatus = bannerMode === 'status'"), "tracks whether the bar was already showing status");
        assert.ok(s.includes("if (!wasStatus)"), "rebuilds the button row only on a mode change");
        assert.ok(s.includes("if (textEl.textContent !== text)"), "writes the text only when it differs");
    });

    // The session context line moved out of the toolbar into the bar, which builds it at load. The
    // id must be preserved: viewer-session-header.ts:applySessionInfo() finds it by getElementById.
    test("the bar owns the session context line and keeps its id", () => {
        const s = getLogBannerScript();
        assert.ok(s.includes("detailsEl.id = 'session-details-inline'"), "creates the details span with the wired id");
        assert.strictEqual(stringsWebview["viewer.logBanner.details.label"], "Log context");
    });

    // currentUri is the SIDEBAR provider's file, broadcast unchanged to every target, so a pop-out
    // showing a file the sidebar never tracked gets ''. Its own footer filename proves a log is open.
    test("a pop-out with no host currentUri still shows the bar", () => {
        const s = getLogBannerScript();
        assert.ok(
            s.includes("if (!ctx.currentUri && !footerFilename() && !bannerMode) { return; }"),
            "falls back to the per-target footer filename before giving up",
        );
    });
});
