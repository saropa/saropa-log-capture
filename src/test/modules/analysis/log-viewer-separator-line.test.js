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
        test("classic === rule", () => {
            assert.strictEqual((0, log_viewer_separator_line_1.isLogViewerSeparatorLine)("==============================="), true);
        });
    });
});
//# sourceMappingURL=log-viewer-separator-line.test.js.map