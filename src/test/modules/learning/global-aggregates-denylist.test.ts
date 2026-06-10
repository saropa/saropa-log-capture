import * as assert from "assert";
import {
    checkPromotionDenyList,
    isPromotable,
} from "../../../modules/learning/global-aggregates-denylist";

suite("global-aggregates deny-list (privacy)", () => {
    // The load-bearing check: anything that could identify a project, path, or user must reject.
    const identifying: Array<[string, string]> = [
        ["windows path", "Error in C:\\Users\\craig\\app\\main.dart"],
        ["unc path", "load failed \\\\server\\share\\x"],
        ["posix home", "open /home/craig/project/x failed"],
        ["posix Users", "/Users/craig/dev/app crashed"],
        ["posix abs", "wrote /var/log/app/output.txt"],
        ["file uri", "asset file:///d:/src/contacts/lib/main.dart"],
        ["user profile env", "%USERPROFILE%\\AppData missing"],
        ["explicit Users dir", "Users\\craig\\cfg not found"],
        ["email", "reported by craig.hathaway@saropa.com"],
        ["git remote", "fetch github.com:saropa/contacts.git"],
        ["package import", "package:contacts/models/foo.dart"],
    ];

    for (const [name, pattern] of identifying) {
        test(`rejects ${name}`, () => {
            const r = checkPromotionDenyList(pattern);
            assert.strictEqual(r.allowed, false, `should reject: ${pattern}`);
            assert.ok(r.matchedRule, "rejection should name the matched rule");
            assert.strictEqual(isPromotable(pattern), false);
        });
    }

    // Generic framework noise carries no identifying content and must pass.
    const generic = [
        "Recompiling because main.dart has changed",
        "W/MediaCodec: Codec reported err",
        "I/flutter : Another exception was thrown",
        "Reloaded 1 of 512 libraries",
        "D/EGL_emulation: eglMakeCurrent",
    ];
    for (const pattern of generic) {
        test(`allows generic noise: ${pattern.slice(0, 24)}…`, () => {
            assert.strictEqual(checkPromotionDenyList(pattern).allowed, true, `should allow: ${pattern}`);
            assert.strictEqual(isPromotable(pattern), true);
        });
    }
});
