import * as assert from "assert";
import { extractPatterns } from "../../../modules/learning/pattern-extractor";
import type { UserInteraction } from "../../../modules/learning/interaction-types";

function at(ts: number, type: UserInteraction["type"], text: string): UserInteraction {
    return { timestamp: ts, type, lineText: text, lineLevel: "log" };
}

suite("pattern-extractor", () => {
    test("returns empty when too few interactions", () => {
        const lines: UserInteraction[] = [];
        for (let i = 0; i < 5; i++) {
            lines.push(at(i, "dismiss", `noise line ${i} same`));
        }
        assert.deepStrictEqual(extractPatterns(lines, 0.5, []), []);
    });

    test("finds repetitive plain pattern with enough dismiss signals", () => {
        const msg = "Recompiling because main.dart has changed";
        const lines: UserInteraction[] = [];
        for (let i = 0; i < 12; i++) {
            lines.push(at(i, "dismiss", msg));
        }
        const out = extractPatterns(lines, 0.5, []);
        assert.ok(out.length >= 1);
        const rep = out.find((p) => p.category === "repetitive");
        assert.ok(rep, "expected repetitive category");
        assert.ok(rep!.pattern.length > 0);
        assert.ok(rep!.confidence >= 0.5);
    });

    test("skips pattern that would exclude an explicit-keep line", () => {
        const keep = "KEEP_THIS_UNIQUE_LINE";
        const lines: UserInteraction[] = [];
        for (let i = 0; i < 10; i++) {
            lines.push(at(i, "dismiss", keep));
        }
        lines.push(at(99, "explicit-keep", keep));
        const out = extractPatterns(lines, 0.3, []);
        assert.strictEqual(out.length, 0);
    });

    test("false positive: many unrelated dismiss lines produce no pattern", () => {
        const lines: UserInteraction[] = [];
        for (let i = 0; i < 20; i++) {
            lines.push(at(i, "dismiss", `unique noise payload ${i} ${"x".repeat(20)}`));
        }
        assert.deepStrictEqual(extractPatterns(lines, 0.5, []), []);
    });

    test("explicit-keep on a different line does not block repetitive pattern for dismiss-only text", () => {
        const noise = "SAME_NOISE_LINE_FOR_EXTRACT";
        const lines: UserInteraction[] = [];
        for (let i = 0; i < 12; i++) {
            lines.push(at(i, "dismiss", noise));
        }
        lines.push(at(200, "explicit-keep", "OTHER_LINE_USER_BOOKMARKED"));
        const out = extractPatterns(lines, 0.5, []);
        assert.ok(out.some((p) => p.sampleLines.some((s) => s.includes("SAME_NOISE"))));
    });

    test("skip-scroll alone does not inflate confidence vs dismiss-only at same minConfidence edge", () => {
        const msg = "SCROLL_SEEN_LINE_REPEAT";
        const scrollOnly: UserInteraction[] = [];
        for (let i = 0; i < 15; i++) {
            scrollOnly.push(at(i, "skip-scroll", msg));
        }
        const dismissOnly: UserInteraction[] = [];
        for (let i = 0; i < 12; i++) {
            dismissOnly.push(at(i, "dismiss", msg));
        }
        const fromScroll = extractPatterns(scrollOnly, 0.72, []);
        const fromDismiss = extractPatterns(dismissOnly, 0.72, []);
        assert.ok(
            fromDismiss.length >= fromScroll.length,
            "dismiss-only should be at least as likely to produce suggestions as skip-scroll-only",
        );
    });
});
