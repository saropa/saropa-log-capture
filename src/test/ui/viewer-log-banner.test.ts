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
});
