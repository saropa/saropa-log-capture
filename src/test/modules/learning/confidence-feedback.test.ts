import * as assert from "assert";
import {
    applyFeedback,
    buildFeedback,
    patternSimilarity,
    type SuggestionFeedback,
} from "../../../modules/learning/confidence-feedback";
import type { PersistedRuleSuggestion, SuggestionStatus } from "../../../modules/learning/learning-store";

const NONE: SuggestionFeedback = { exactAccepts: 0, exactRejects: 0, similarAccepts: 0, similarRejects: 0 };

function row(pattern: string, status: SuggestionStatus): PersistedRuleSuggestion {
    return {
        id: pattern + ":" + status, pattern, description: "", confidence: 0.9, status,
        createdAt: 0, sampleLines: [], category: "framework", matchCount: 1,
    };
}

suite("confidence-feedback applyFeedback", () => {
    test("no feedback leaves confidence unchanged", () => {
        assert.strictEqual(applyFeedback(0.8, NONE), 0.8);
    });

    test("a prior accept boosts confidence above raw", () => {
        const out = applyFeedback(0.5, { ...NONE, exactAccepts: 1 });
        assert.ok(out > 0.5, "accept should raise confidence");
        assert.ok(Math.abs(out - 0.5 * 1.15) < 1e-9, "one accept multiplies by 1.15");
    });

    test("a prior reject penalizes confidence below raw", () => {
        const out = applyFeedback(0.5, { ...NONE, exactRejects: 1 });
        assert.ok(out < 0.5, "reject should lower confidence");
        assert.ok(Math.abs(out - 0.5 * 0.6) < 1e-9, "one reject multiplies by 0.6");
    });

    test("a similar pattern earns half the effect of an exact one", () => {
        const exact = applyFeedback(0.5, { ...NONE, exactAccepts: 1 });
        const similar = applyFeedback(0.5, { ...NONE, similarAccepts: 1 });
        assert.ok(similar > 0.5 && similar < exact, "similar accept boosts less than exact");
        assert.ok(Math.abs(similar - 0.5 * 1.075) < 1e-9, "similar accept uses half the deviation (1.075)");
    });

    test("the multiplier ceiling caps runaway boosts (1.5x raw)", () => {
        // Five exact accepts would be 1.15^5 ≈ 2.01x without the cap.
        const out = applyFeedback(0.6, { ...NONE, exactAccepts: 5 });
        assert.ok(Math.abs(out - 0.6 * 1.5) < 1e-9, "multiplier clamps to the 1.5 ceiling");
    });

    test("the multiplier floor bounds penalties and the result clamps to [0,1]", () => {
        const out = applyFeedback(1, { ...NONE, exactRejects: 10 });
        assert.ok(Math.abs(out - 1 * 0.1) < 1e-9, "multiplier clamps to the 0.1 floor");
        assert.ok(applyFeedback(1, { ...NONE, exactAccepts: 20 }) <= 1, "confidence never exceeds 1");
    });
});

suite("confidence-feedback patternSimilarity", () => {
    test("identical strings score 1", () => {
        assert.strictEqual(patternSimilarity("abc", "abc"), 1);
    });
    test("a contained shorter string scores its length ratio", () => {
        // "MediaCodec" inside "I/MediaCodec err" → 10/16
        assert.ok(Math.abs(patternSimilarity("MediaCodec", "I/MediaCodec err") - 10 / 16) < 1e-9);
    });
    test("unrelated strings score 0", () => {
        assert.strictEqual(patternSimilarity("abc", "xyz"), 0);
    });
});

suite("confidence-feedback buildFeedback", () => {
    test("counts exact accepts/rejects and ignores pending rows", () => {
        const history = [row("flutter noise", "accepted"), row("flutter noise", "rejected"), row("flutter noise", "pending")];
        const fb = buildFeedback("flutter noise", history);
        assert.strictEqual(fb.exactAccepts, 1);
        assert.strictEqual(fb.exactRejects, 1);
        assert.strictEqual(fb.similarAccepts, 0);
    });

    test("a >80% overlap pattern feeds the similar counters, not the exact ones", () => {
        // "flutter noise" is 13/14 of "flutter noisex" → 0.93 ≥ 0.8, not identical.
        const fb = buildFeedback("flutter noisex", [row("flutter noise", "rejected")]);
        assert.strictEqual(fb.exactRejects, 0, "not an exact match");
        assert.strictEqual(fb.similarRejects, 1, "counts as similar");
    });

    test("a low-overlap pattern contributes nothing", () => {
        const fb = buildFeedback("totally different", [row("flutter noise", "rejected")]);
        assert.deepStrictEqual(fb, NONE);
    });
});
