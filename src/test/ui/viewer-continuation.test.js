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
const viewer_data_add_continuation_1 = require("../../ui/viewer/viewer-data-add-continuation");
suite('Continuation line collapsing', () => {
    test('should produce valid JavaScript', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.doesNotThrow(() => new Function(script), 'continuation script should parse without syntax errors');
    });
    test('should define all expected state variables', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.ok(script.includes('var activeContHeader = null'));
        assert.ok(script.includes('var nextContGroupId = 0'));
        assert.ok(script.includes('var contHeaderMap = {}'));
        assert.ok(script.includes('var contMaxChildren = 200'));
        assert.ok(script.includes('var contAutoCollapseThreshold = 5'));
        assert.ok(script.includes('var lastNormalLineForCont = null'));
    });
    test('should define all expected functions', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        const expected = [
            'matchesContinuation', 'finalizeContinuationGroup',
            'checkContinuationOnNormalLine', 'breakContinuationGroup',
            'toggleContinuationGroup', 'resetContinuationState',
            'cleanupContinuationAfterTrim', 'expandContinuationForSearch',
        ];
        for (const fn of expected) {
            assert.ok(script.includes(`function ${fn}`), `should define ${fn}`);
        }
    });
    test('should guard against null timestamps in matchesContinuation', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.ok(script.includes('item.timestamp == null'));
        assert.ok(script.includes('prev.timestamp == null'));
    });
    test('should enforce max children limit', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.ok(script.includes('activeContHeader.contChildCount < contMaxChildren'));
    });
    test('should skip separators from continuation detection', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.ok(script.includes('lineItem.isSeparator'));
    });
    test('finalizeContinuationGroup should adjust totalHeight when auto-collapsing', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        assert.ok(script.includes('totalHeight -= allLines[ci].height'), 'should subtract child heights from totalHeight on auto-collapse');
    });
    test('expandContinuationForSearch should call recalcHeights after expanding', () => {
        const script = (0, viewer_data_add_continuation_1.getContinuationScript)();
        const fnBody = script.substring(script.indexOf('function expandContinuationForSearch'));
        assert.ok(fnBody.includes('recalcHeights'), 'should recalc after search-expand');
    });
});
//# sourceMappingURL=viewer-continuation.test.js.map