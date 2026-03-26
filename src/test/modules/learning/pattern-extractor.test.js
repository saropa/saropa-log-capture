"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const pattern_extractor_1 = require("../../../modules/learning/pattern-extractor");
function at(ts, type, text) {
    return { timestamp: ts, type, lineText: text, lineLevel: "log" };
}
suite("pattern-extractor", () => {
    test("returns empty when too few interactions", () => {
        const lines = [];
        for (let i = 0; i < 5; i++) {
            lines.push(at(i, "dismiss", `noise line ${i} same`));
        }
        assert.deepStrictEqual((0, pattern_extractor_1.extractPatterns)(lines, 0.5, []), []);
    });
    test("finds repetitive plain pattern with enough dismiss signals", () => {
        const msg = "Recompiling because main.dart has changed";
        const lines = [];
        for (let i = 0; i < 12; i++) {
            lines.push(at(i, "dismiss", msg));
        }
        const out = (0, pattern_extractor_1.extractPatterns)(lines, 0.5, []);
        assert.ok(out.length >= 1);
        const rep = out.find((p) => p.category === "repetitive");
        assert.ok(rep, "expected repetitive category");
        assert.ok(rep.pattern.length > 0);
        assert.ok(rep.confidence >= 0.5);
    });
    test("skips pattern that would exclude an explicit-keep line", () => {
        const keep = "KEEP_THIS_UNIQUE_LINE";
        const lines = [];
        for (let i = 0; i < 10; i++) {
            lines.push(at(i, "dismiss", keep));
        }
        lines.push(at(99, "explicit-keep", keep));
        const out = (0, pattern_extractor_1.extractPatterns)(lines, 0.3, []);
        assert.strictEqual(out.length, 0);
    });
    test("false positive: many unrelated dismiss lines produce no pattern", () => {
        const lines = [];
        for (let i = 0; i < 20; i++) {
            lines.push(at(i, "dismiss", `unique noise payload ${i} ${"x".repeat(20)}`));
        }
        assert.deepStrictEqual((0, pattern_extractor_1.extractPatterns)(lines, 0.5, []), []);
    });
    test("explicit-keep on a different line does not block repetitive pattern for dismiss-only text", () => {
        const noise = "SAME_NOISE_LINE_FOR_EXTRACT";
        const lines = [];
        for (let i = 0; i < 12; i++) {
            lines.push(at(i, "dismiss", noise));
        }
        lines.push(at(200, "explicit-keep", "OTHER_LINE_USER_BOOKMARKED"));
        const out = (0, pattern_extractor_1.extractPatterns)(lines, 0.5, []);
        assert.ok(out.some((p) => p.sampleLines.some((s) => s.includes("SAME_NOISE"))));
    });
    test("skip-scroll alone does not inflate confidence vs dismiss-only at same minConfidence edge", () => {
        const msg = "SCROLL_SEEN_LINE_REPEAT";
        const scrollOnly = [];
        for (let i = 0; i < 15; i++) {
            scrollOnly.push(at(i, "skip-scroll", msg));
        }
        const dismissOnly = [];
        for (let i = 0; i < 12; i++) {
            dismissOnly.push(at(i, "dismiss", msg));
        }
        const fromScroll = (0, pattern_extractor_1.extractPatterns)(scrollOnly, 0.72, []);
        const fromDismiss = (0, pattern_extractor_1.extractPatterns)(dismissOnly, 0.72, []);
        assert.ok(fromDismiss.length >= fromScroll.length, "dismiss-only should be at least as likely to produce suggestions as skip-scroll-only");
    });
});
//# sourceMappingURL=pattern-extractor.test.js.map