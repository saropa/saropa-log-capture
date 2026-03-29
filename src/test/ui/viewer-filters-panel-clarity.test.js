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
const viewer_filters_panel_html_1 = require("../../ui/viewer-search-filter/viewer-filters-panel-html");
const viewer_filters_panel_script_1 = require("../../ui/viewer-search-filter/viewer-filters-panel-script");
const viewer_scope_filter_1 = require("../../ui/viewer-search-filter/viewer-scope-filter");
suite('Filters panel clarity (streams vs code location)', () => {
    test('HTML uses Log Streams, Code Location Scope, and scope narrowing wrapper ids', () => {
        const html = (0, viewer_filters_panel_html_1.getFiltersPanelHtml)();
        assert.ok(html.includes('Log Streams'));
        assert.ok(html.includes('SQL Commands'));
        assert.ok(html.includes('Code Location Scope'));
        assert.ok(html.includes('id="scope-narrowing-block"'));
        assert.ok(html.includes('id="scope-no-context-hint"'));
        assert.ok(html.includes('Hide lines without file path'));
        assert.ok(html.includes('id="source-streams-intro"'));
        assert.ok(html.includes('id="scope-filter-hint"'));
    });
    test('filters panel script groups external streams with a titled subsection', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(script.includes('External sidecars ('));
        assert.ok(script.includes('source-external-group-title'));
        assert.ok(script.includes('commitSourceFilterFromCheckboxes'));
        assert.ok(script.includes('getSourceFilterCheckboxes'));
    });
    test('filters panel script maps external: stream ids to readable labels', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(script.includes('External · '));
        assert.ok(script.includes('External (sidecar log)'));
        assert.ok(script.includes("id.indexOf('external:') === 0"));
    });
    test('scope script toggles narrowing visibility when no active editor', () => {
        const script = (0, viewer_scope_filter_1.getScopeFilterScript)();
        assert.ok(script.includes('function updateScopeNarrowingVisibility'));
        assert.ok(script.includes('scope-narrowing-block'));
        assert.ok(script.includes('scope-no-context-hint'));
        assert.ok(script.includes('!scopeContext.activeFilePath && scopeLevel'));
    });
    test('scope script updates contextual hint and hooks recalcHeights', () => {
        const script = (0, viewer_scope_filter_1.getScopeFilterScript)();
        assert.ok(script.includes('function updateScopeFilterHint'));
        assert.ok(script.includes('function scheduleScopeFilterHint'));
        assert.ok(script.includes('function flushScopeFilterHint'));
        assert.ok(script.includes('scope-filter-hint'));
        assert.ok(script.includes('_origRecalcForScopeHint'));
        assert.ok(script.includes('scheduleScopeFilterHint'));
        assert.ok(script.includes('scopeHintHiddenRatio = 0.75'));
        assert.ok(script.includes('scopeHintNoPathRatio = 0.25'));
        assert.ok(script.includes('data-scope-reset="all"'));
        assert.ok(script.includes('Reset to All logs'));
    });
});
//# sourceMappingURL=viewer-filters-panel-clarity.test.js.map