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
const duration_extractor_1 = require("../../../modules/analysis/duration-extractor");
suite('DurationExtractor', () => {
    test('should extract milliseconds from "500ms"', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('completed in 500ms'), 500);
    });
    test('should extract milliseconds from "1.5ms"', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('request took 1.5ms'), 1.5);
    });
    test('should extract seconds and convert to ms', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('finished in 2.5s'), 2500);
    });
    test('should extract "seconds" word form', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('ran for 3 seconds'), 3000);
    });
    test('should extract "took Ns" pattern', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('took 1.2s to complete'), 1200);
    });
    test('should extract "elapsed: Nms" pattern', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('elapsed: 750ms'), 750);
    });
    test('should extract "duration=N" bare number as ms', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('duration=3000'), 3000);
    });
    test('should return undefined for no match', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('no timing info here'), undefined);
    });
    test('should return undefined for empty string', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)(''), undefined);
    });
    test('should handle "(1234ms)" in parentheses', () => {
        assert.strictEqual((0, duration_extractor_1.extractDuration)('build complete (1234ms)'), 1234);
    });
});
//# sourceMappingURL=duration-extractor.test.js.map