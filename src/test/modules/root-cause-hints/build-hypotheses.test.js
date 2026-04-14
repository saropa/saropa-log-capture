"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const build_hypotheses_1 = require("../../../modules/root-cause-hints/build-hypotheses");
const root_cause_hint_eligibility_1 = require("../../../modules/root-cause-hints/root-cause-hint-eligibility");
const base = {
    bundleVersion: 1,
    sessionId: "s1",
};
(0, node_test_1.default)("isRootCauseHintsEligible: false for wrong version or missing sessionId", () => {
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)({ ...base, bundleVersion: 99 }), false);
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)({ bundleVersion: 1, sessionId: "" }), false);
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)({ bundleVersion: 2, sessionId: "" }), false);
});
(0, node_test_1.default)("isRootCauseHintsEligible: true with qualifying error excerpt", () => {
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)({
        ...base,
        errors: [{ lineIndex: 1, excerpt: "boom" }],
    }), true);
});
(0, node_test_1.default)("isRootCauseHintsEligible: false for short error excerpt", () => {
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)({
        ...base,
        errors: [{ lineIndex: 1, excerpt: "ab" }],
    }), false);
});
(0, node_test_1.default)("buildHypotheses: empty for ineligible bundle", () => {
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)({
        ...base,
        fingerprintLeaders: [{ fingerprint: "fp", count: 3, sampleLineIndex: 0 }],
    }), []);
});
(0, node_test_1.default)("buildHypotheses: error tier sorts before fingerprint leader", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [{ lineIndex: 10, excerpt: "Something failed badly here" }],
        fingerprintLeaders: [{ fingerprint: "fp1", count: 20, sampleLineIndex: 5 }],
    });
    strict_1.default.ok(hy.length >= 2);
    strict_1.default.equal(hy[0].templateId, "error-recent");
    strict_1.default.equal(hy[0].evidenceLineIds[0], 10);
    strict_1.default.ok(hy.some((h) => h.templateId === "fingerprint-leader"));
});
(0, node_test_1.default)("buildHypotheses: N+1 for same fingerprint drops duplicate fingerprint leader", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        nPlusOneHints: [
            {
                lineIndex: 2,
                fingerprint: "same",
                repeats: 10,
                distinctArgs: 4,
                windowSpanMs: 500,
                confidence: "medium",
            },
        ],
        fingerprintLeaders: [{ fingerprint: "same", count: 30, sampleLineIndex: 1 }],
    });
    const fpOnly = hy.filter((h) => h.templateId === "fingerprint-leader");
    strict_1.default.equal(fpOnly.length, 0);
    strict_1.default.ok(hy.some((h) => h.templateId === "n-plus-one"));
});
(0, node_test_1.default)("buildHypotheses: caps at ROOT_CAUSE_MAX_HYPOTHESES", () => {
    const hints = Array.from({ length: 12 }, (_, i) => ({
        lineIndex: i,
        fingerprint: `f${i}`,
        repeats: 10,
        distinctArgs: 3,
        windowSpanMs: 400,
        confidence: "low",
    }));
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        nPlusOneHints: hints,
    });
    strict_1.default.equal(hy.length, build_hypotheses_1.ROOT_CAUSE_MAX_HYPOTHESES);
});
(0, node_test_1.default)("buildHypotheses: text length at most ROOT_CAUSE_MAX_TEXT_LEN", () => {
    const long = "x".repeat(400);
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [{ lineIndex: 0, excerpt: long }],
    });
    strict_1.default.equal(hy.length, 1);
    strict_1.default.ok(hy[0].text.length <= build_hypotheses_1.ROOT_CAUSE_MAX_TEXT_LEN);
});
(0, node_test_1.default)("buildHypotheses: unknown bundleVersion returns []", () => {
    const bad = { ...base, bundleVersion: 99 };
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)(bad), []);
});
(0, node_test_1.default)("isRootCauseHintsEligible / buildHypotheses: fingerprint leader just below threshold (false positive guard)", () => {
    const b = {
        ...base,
        fingerprintLeaders: [{ fingerprint: "fp", count: root_cause_hint_eligibility_1.ROOT_CAUSE_FP_LEADER_MIN_COUNT - 1, sampleLineIndex: 0 }],
    };
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)(b), false);
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)(b), []);
});
(0, node_test_1.default)("isRootCauseHintsEligible / buildHypotheses: sql burst just below threshold (false positive guard)", () => {
    const b = {
        ...base,
        sqlBursts: [{ fingerprint: "fp", count: root_cause_hint_eligibility_1.ROOT_CAUSE_SQL_BURST_MIN_COUNT - 1 }],
    };
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)(b), false);
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)(b), []);
});
(0, node_test_1.default)("buildHypotheses: same error text on different lines merges into one hypothesis with both evidence IDs", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [
            { lineIndex: 3, excerpt: "connection refused on port 8642" },
            { lineIndex: 7, excerpt: "connection refused on port 8642" },
        ],
    });
    const errHy = hy.filter((h) => h.templateId === "error-recent");
    strict_1.default.equal(errHy.length, 1);
    strict_1.default.ok(errHy[0].evidenceLineIds.includes(3));
    strict_1.default.ok(errHy[0].evidenceLineIds.includes(7));
});
(0, node_test_1.default)("buildHypotheses: errors ranked by frequency, most frequent text first", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [
            { lineIndex: 10, excerpt: "disk full" },
            { lineIndex: 1, excerpt: "connection refused on port 8642" },
            { lineIndex: 2, excerpt: "connection refused on port 8642" },
            { lineIndex: 3, excerpt: "connection refused on port 8642" },
        ],
    });
    const errHy = hy.filter((h) => h.templateId === "error-recent");
    strict_1.default.equal(errHy.length, 2);
    strict_1.default.equal(errHy[0].evidenceLineIds.length, 3);
    strict_1.default.equal(errHy[1].evidenceLineIds.length, 1);
});
(0, node_test_1.default)("buildHypotheses: timestamp-varying duplicates merge (suffix-based key)", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [
            { lineIndex: 5, excerpt: "04-01 17:23:59.153 565 565 E adbd : failed to connect to socket tcp:8642" },
            { lineIndex: 6, excerpt: "04-01 17:23:59.467 565 565 E adbd : failed to connect to socket tcp:8642" },
        ],
    });
    const errHy = hy.filter((h) => h.templateId === "error-recent");
    strict_1.default.equal(errHy.length, 1);
    strict_1.default.ok(errHy[0].evidenceLineIds.includes(5));
    strict_1.default.ok(errHy[0].evidenceLineIds.includes(6));
});
(0, node_test_1.default)("buildHypotheses: timestamp-stripped errors stay separate from genuinely different errors", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [
            { lineIndex: 1, excerpt: "04-01 17:00:00.111 565 565 E adbd : failed to connect to socket tcp:8642" },
            { lineIndex: 2, excerpt: "04-01 17:00:00.222 565 565 E adbd : failed to connect to socket tcp:8642" },
            { lineIndex: 3, excerpt: "04-01 17:00:00.333 565 565 E SurfaceFlinger : display was null" },
        ],
    });
    const errHy = hy.filter((h) => h.templateId === "error-recent");
    strict_1.default.strictEqual(errHy.length, 2);
    strict_1.default.strictEqual(errHy[0].evidenceLineIds.length, 2);
    strict_1.default.strictEqual(errHy[1].evidenceLineIds.length, 1);
});
(0, node_test_1.default)("buildHypotheses: whitespace-only error excerpts do not qualify (no strip)", () => {
    const b = {
        ...base,
        errors: [
            { lineIndex: 0, excerpt: "    " },
            { lineIndex: 1, excerpt: "\t\n" },
        ],
    };
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)(b), false);
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)(b), []);
});
(0, node_test_1.default)("buildHypotheses: decorative separator lines are filtered out (not real errors)", () => {
    const separators = {
        ...base,
        errors: [
            { lineIndex: 0, excerpt: "═══════════════════════════════════════" },
            { lineIndex: 1, excerpt: "────────────────────────────────────────" },
            { lineIndex: 2, excerpt: "========================================" },
            { lineIndex: 3, excerpt: "****************************************" },
            { lineIndex: 4, excerpt: "▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼" },
        ],
    };
    // Eligibility still passes (excerpts pass length check) but hypotheses are empty
    strict_1.default.deepEqual((0, build_hypotheses_1.buildHypotheses)(separators), []);
});
(0, node_test_1.default)("buildHypotheses: mixed decorative and real errors only surfaces real ones", () => {
    const hy = (0, build_hypotheses_1.buildHypotheses)({
        ...base,
        errors: [
            { lineIndex: 0, excerpt: "═══════════════════════════════════════" },
            { lineIndex: 1, excerpt: "RenderFlex overflowed by 42 pixels" },
            { lineIndex: 2, excerpt: "────────────────────────────────────────" },
        ],
    });
    const errHy = hy.filter((h) => h.templateId === "error-recent");
    strict_1.default.strictEqual(errHy.length, 1);
    strict_1.default.ok(errHy[0].text.includes("RenderFlex"));
});
(0, node_test_1.default)("buildHypotheses: sql burst at threshold is eligible and emits burst template", () => {
    const b = {
        ...base,
        sqlBursts: [{ fingerprint: "bfp", count: root_cause_hint_eligibility_1.ROOT_CAUSE_SQL_BURST_MIN_COUNT, windowMs: 100 }],
    };
    strict_1.default.equal((0, root_cause_hint_eligibility_1.isRootCauseHintsEligible)(b), true);
    const hy = (0, build_hypotheses_1.buildHypotheses)(b);
    strict_1.default.ok(hy.some((h) => h.templateId === "sql-burst" && h.hypothesisKey === "burst::bfp"));
});
// v2 general signal tests and fingerprinting tests are in build-hypotheses-general.test.ts
//# sourceMappingURL=build-hypotheses.test.js.map