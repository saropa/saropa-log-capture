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
const viewer_tag_selection_guard_1 = require("../../ui/viewer-stack-tags/viewer-tag-selection-guard");
const viewer_source_tags_1 = require("../../ui/viewer-stack-tags/viewer-source-tags");
const viewer_class_tags_1 = require("../../ui/viewer-stack-tags/viewer-class-tags");
suite('Viewer Tag Selection Guard', () => {
    function createGuardFn() {
        const factory = new Function(`${(0, viewer_tag_selection_guard_1.getTagSelectionGuardScript)()}\nreturn ensureAtLeastOneTagVisible;`);
        return factory();
    }
    test('resets to all-visible when toggle state hides all known tags', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true, beta: true };
        const counts = { alpha: 12, beta: 5 };
        assert.deepStrictEqual(ensureVisible(hidden, counts), {});
    });
    test('keeps state when at least one tag remains visible (false-positive guard)', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true };
        const counts = { alpha: 12, beta: 5 };
        assert.deepStrictEqual(ensureVisible(hidden, counts), hidden);
    });
    test('does not reset when there are no known tags (false-positive guard)', () => {
        const ensureVisible = createGuardFn();
        const hidden = { alpha: true };
        assert.deepStrictEqual(ensureVisible(hidden, {}), hidden);
    });
    test('source and class tag toggles use shared guard helper', () => {
        const sourceScript = (0, viewer_source_tags_1.getSourceTagsScript)();
        const classScript = (0, viewer_class_tags_1.getClassTagsScript)();
        assert.ok(sourceScript.includes('ensureAtLeastOneTagVisible(hiddenSourceTags, sourceTagCounts)'));
        assert.ok(classScript.includes('ensureAtLeastOneTagVisible(hiddenClassTags, classTagCounts)'));
        // Ensure legacy duplicated loops are gone from both toggles.
        assert.ok(!sourceScript.includes('var visibleCount = 0;'));
        assert.ok(!classScript.includes('var visibleCount = 0;'));
    });
});
//# sourceMappingURL=viewer-tag-selection-guard.test.js.map