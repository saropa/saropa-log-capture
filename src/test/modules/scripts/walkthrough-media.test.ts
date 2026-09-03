/**
 * Bug 001 regression: contributes.walkthroughs[*].steps[*].media.markdown must resolve to a
 * real file under media/walkthrough/ (loaded at runtime and shipped in the .vsix), never
 * under plans/** (excluded by .vscodeignore — a step pointed there renders an empty body).
 */
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

function repoRoot(): string {
    return path.resolve(__dirname, "..", "..", "..", "..");
}

interface WalkthroughStep {
    readonly id: string;
    readonly media?: { readonly markdown?: string; readonly image?: string };
}

interface WalkthroughEntry {
    readonly steps?: readonly WalkthroughStep[];
}

interface PackageJsonShape {
    readonly contributes?: { readonly walkthroughs?: readonly WalkthroughEntry[] };
}

suite("walkthrough media paths (generated-adjacent, verified at compile)", () => {
    test("every walkthrough step media path exists on disk and lives under media/", () => {
        const pkgPath = path.join(repoRoot(), "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as PackageJsonShape;
        const walkthroughs = pkg.contributes?.walkthroughs ?? [];
        assert.ok(walkthroughs.length > 0, "expected at least one contributed walkthrough");

        for (const wt of walkthroughs) {
            for (const step of wt.steps ?? []) {
                const markdown = step.media?.markdown;
                if (!markdown) { continue; }
                // media/walkthrough/*.md is the only location .vscodeignore leaves in the
                // .vsix for these files (plans/** and docs/** are both excluded) — see
                // bugs/bug_001_walkthrough-markdown-missing-from-vsix.md for the incident
                // this guards against.
                assert.ok(
                    markdown.startsWith("media/walkthrough/"),
                    `step "${step.id}" media.markdown "${markdown}" must live under media/walkthrough/`,
                );
                const abs = path.join(repoRoot(), markdown);
                assert.ok(fs.existsSync(abs), `step "${step.id}" media.markdown "${markdown}" does not exist`);
            }
        }
    });

    test("plans/walkthrough/ no longer exists (superseded by media/walkthrough/)", () => {
        // The bug's root cause was a doc-consolidation commit that moved these files to
        // plans/walkthrough/ without updating package.json. Guard against the copy
        // reappearing and drifting from the shipped media/walkthrough/ copy.
        const stalePath = path.join(repoRoot(), "plans", "walkthrough");
        assert.strictEqual(fs.existsSync(stalePath), false, "plans/walkthrough/ should not exist");
    });
});
