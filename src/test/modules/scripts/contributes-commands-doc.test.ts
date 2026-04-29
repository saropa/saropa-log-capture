/**
 * `doc/internal/contributes-commands.md` is generated from package.json for keybinding reference.
 */
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

function repoRoot(): string {
    return path.resolve(__dirname, "..", "..", "..", "..");
}

suite("contributes commands doc (generated)", () => {
    test("committed commands reference is present and auto-generated", () => {
        const p = path.join(repoRoot(), "doc", "internal", "contributes-commands.md");
        assert.ok(fs.existsSync(p));
        const text = fs.readFileSync(p, "utf8");
        assert.ok(text.includes("AUTO-GENERATED"), "banner");
        assert.ok(text.includes("saropaLogCapture.start"), "sample command id");
        assert.ok(text.includes("**Total:**") && /\d+\s+commands/.test(text), "total line");
    });
});
