/**
 * Minimal Extension Host smoke: extension entry resolves and activates.
 * Catches packaging / activation regressions that pure unit tests miss.
 */
import * as assert from "assert";
import * as vscode from "vscode";

const EXTENSION_ID = "saropa.saropa-log-capture";

suite("Extension smoke (activation)", () => {
    test(`${EXTENSION_ID} resolves and activates`, async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext, "extension must be present in Extension Test Host");
        await ext.activate();
        assert.strictEqual(ext.isActive, true, "activate() should leave extension active");
    });
});
