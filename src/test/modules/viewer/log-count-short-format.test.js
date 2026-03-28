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
const log_count_short_format_1 = require("../../../modules/viewer/log-count-short-format");
suite("formatLogCountShort", () => {
    test("small integers unchanged", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(0), "0");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999), "999");
    });
    test("thousands use k suffix", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1000), "1k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1500), "1.5k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(5000), "5k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(10000), "10k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(10500), "10.5k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999000), "999k");
    });
    test("millions use M suffix", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1_000_000), "1M");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1_200_000), "1.2M");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(10_000_000), "10M");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(10_500_000), "10.5M");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999_000_000), "999M");
    });
    test("billions use B suffix", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1_000_000_000), "1B");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(2_500_000_000), "2.5B");
    });
    test("non-finite and negative clamp to 0", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(NaN), "0");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(-3), "0");
    });
    test("boundary values do not round up to next unit", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999_499), "999k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999_500), "999k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999_999), "999k");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(999_999_999), "999M");
    });
    test("floors fractional input", () => {
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(5.9), "5");
        assert.strictEqual((0, log_count_short_format_1.formatLogCountShort)(1500.2), "1.5k");
    });
});
//# sourceMappingURL=log-count-short-format.test.js.map