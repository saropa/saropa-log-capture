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
const assert = __importStar(require("node:assert"));
const drift_log_line_args_fold_1 = require("../../../modules/db/drift-log-line-args-fold");
suite("drift-log-line-args-fold", () => {
    test("trySplitDriftSqlArgsSuffix splits on last with args in Drift: Sent body", () => {
        const raw = 'I/flutter: Drift: Sent PRAGMA foreign_key_list("connections") with args []';
        const sp = (0, drift_log_line_args_fold_1.trySplitDriftSqlArgsSuffix)(raw);
        if (!sp) {
            assert.fail("expected split");
        }
        assert.strictEqual(sp.prefix, 'I/flutter: Drift: Sent PRAGMA foreign_key_list("connections")');
        assert.strictEqual(sp.suffix, " with args []");
    });
    test("trySplitDriftSqlArgsSuffix returns null without Drift: Sent", () => {
        assert.strictEqual((0, drift_log_line_args_fold_1.trySplitDriftSqlArgsSuffix)("SELECT 1 with args []"), null);
    });
    test("buildDriftArgsDimHtml wraps suffix in dimmed span", () => {
        const h = (0, drift_log_line_args_fold_1.buildDriftArgsDimHtml)(" with args []");
        assert.ok(h.includes('class="drift-args-dim"'));
        assert.ok(h.includes(" with args []"));
    });
    test("buildLogLineHtmlWithOptionalDriftArgsDim dims args between ansi segments", () => {
        const raw = 'Drift: Sent SELECT 1 with args [1]';
        const html = (0, drift_log_line_args_fold_1.buildLogLineHtmlWithOptionalDriftArgsDim)(raw);
        assert.ok(html.includes("drift-args-dim"));
        assert.ok(html.includes("[1]"));
        assert.ok(html.includes("SELECT 1") || html.includes("SELECT"));
    });
    test("should render suffix exactly once, inside dim wrapper only", () => {
        const raw = 'Drift: Sent PRAGMA table_info("x") with args []';
        const html = (0, drift_log_line_args_fold_1.buildLogLineHtmlWithOptionalDriftArgsDim)(raw);
        assert.ok(html.includes('<span class="drift-args-dim"> with args []</span>'));
        const wrapEnd = html.indexOf('</span>', html.indexOf('drift-args-dim'));
        assert.ok(wrapEnd >= 0, "expected dim wrapper close tag");
        const afterWrap = html.substring(wrapEnd + '</span>'.length);
        assert.strictEqual(afterWrap.includes("with args"), false, "suffix must not appear after dim wrapper (was rendered twice before fix)");
    });
    test("should render non-empty args inside dim wrapper", () => {
        const raw = 'Drift: Sent SELECT * FROM t WHERE id = ? with args [42]';
        const html = (0, drift_log_line_args_fold_1.buildLogLineHtmlWithOptionalDriftArgsDim)(raw);
        assert.ok(html.includes('<span class="drift-args-dim"> with args [42]</span>'));
    });
    test("non-Drift lines match plain ansiLinkify path", () => {
        const plain = "hello world";
        assert.strictEqual((0, drift_log_line_args_fold_1.buildLogLineHtmlWithOptionalDriftArgsDim)(plain), (0, drift_log_line_args_fold_1.ansiLinkifyLineHtml)(plain));
    });
});
//# sourceMappingURL=drift-log-line-args-fold.test.js.map