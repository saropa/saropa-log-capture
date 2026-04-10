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
const log_viewer_separator_line_1 = require("../../../modules/analysis/log-viewer-separator-line");
suite("log-viewer-separator-line (viewer banner / rule detection)", () => {
    suite("before: generic logs are not separators", () => {
        test("plain Drift SQL line is not a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter: Drift: Sent SELECT * FROM "contacts"; with args []'), false);
        });
        test("short non-art line is not a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("hi"), false);
        });
    });
    suite("logcat-prefixed lines strip prefix before detection", () => {
        test("logcat-prefixed paired │ … │ content line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter (13876): │           DRIFT DEBUG SERVER   v3.0.2           │'), true);
        });
        test("logcat-prefixed border line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter (13876): ┌──────────────────────────────────────────────────┐'), true);
        });
        test("logcat-prefixed empty interior row is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter (13876): \u2502                                                      \u2502'), true);
        });
        test("bracket-prefixed box line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('[log] │         http://127.0.0.1:8643         │'), true);
        });
        test("logcat-prefixed plain text is not a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter (13876): Starting application...'), false);
        });
    });
    suite("double-vertical-bar (║) boxes (e.g. Isar Connect)", () => {
        test("logcat-prefixed ║ content line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter ( 5132): ║                     ISAR CONNECT STARTED                     ║'), true);
        });
        test("logcat-prefixed ║ URL content line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter ( 5132): ║ https://inspect.isar-community.dev/3.3.0/#/37391/Q3SG7NeTAHc ║'), true);
        });
        test("logcat-prefixed ╔ border line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter ( 5132): ╔══════════════════════════════════════════════════════════════╗'), true);
        });
        test("logcat-prefixed ╟ divider line is a separator", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)('I/flutter ( 5132): ╟──────────────────────────────────────────────────────────────╢'), true);
        });
    });
    suite("after: Drift-style and Unicode box lines", () => {
        test("paired │ … │ interior row (Drift URL line)", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("      │              http://127.0.0.1:8642               │"), true);
        });
        test("paired │ … │ title row", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("│           DRIFT DEBUG SERVER   v2.10.0           │"), true);
        });
        test("╭/╯ border row (corners counted as art — previously missed without ╭╮╯╰ in set)", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("╭──────────────────────────────────────────────────╮"), true);
        });
        test("paired │ │ empty interior row (whitespace only between bars)", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("\u2502                                                      \u2502"), true);
        });
        test("classic === rule", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("==============================="), true);
        });
    });
});
//# sourceMappingURL=log-viewer-separator-line.test.js.map