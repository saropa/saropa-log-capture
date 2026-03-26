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
const viewer_scope_filter_1 = require("../../ui/viewer-search-filter/viewer-scope-filter");
/** Minimal DOM + globals to evaluate the injected scope-filter script for hint behavior. */
function createScopeHintRuntime() {
    const hintEl = {
        innerHTML: '',
        style: { display: '' },
        _handler: null,
        addEventListener(ev, fn) {
            if (ev === 'click') {
                this._handler = fn;
            }
        },
        removeAttribute() { },
    };
    const allLines = [];
    const factory = new Function('hintStub', 'linesRef', `
        var document = {
            getElementById: function(id) {
                if (id === 'scope-filter-hint') return hintStub;
                if (id === 'scope-hide-unattrib') return { checked: false, addEventListener: function(){} };
                if (id === 'scope-narrowing-block') return { style: {} };
                if (id === 'scope-no-context-hint') return { style: {} };
                if (id === 'scope-status') return { textContent: '', removeAttribute: function(){}, title: '' };
                return null;
            },
            querySelectorAll: function() { return []; }
        };
        var allLines = linesRef;
        var recalcHeights = function() {};
        var renderViewport = function() {};
        var markPresetDirty = function() {};
        ${(0, viewer_scope_filter_1.getScopeFilterScript)()}
        return {
            setActiveFilePath: function(p) { scopeContext.activeFilePath = p; },
            setScopeHideUnattrib: function(v) { scopeHideUnattributed = !!v; },
            getScopeLevel: function() { return scopeLevel; },
            applyScopeFilter: applyScopeFilter,
            flushScopeFilterHint: flushScopeFilterHint,
            setScopeLevel: setScopeLevel,
            fireHintClick: function(target) {
                if (hintStub._handler) hintStub._handler({ target: target });
            }
        };
        `);
    const api = factory(hintEl, allLines);
    return { hintEl, allLines, api };
}
suite('Viewer scope filter hint (behavior)', () => {
    test('does not show hint when line count is below minimum (false positive guard)', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        for (let i = 0; i < 7; i++) {
            allLines.push({ type: 'line', sourcePath: '/other.dart' });
        }
        api.setScopeLevel('file');
        assert.strictEqual(hintEl.style.display, 'none');
        assert.strictEqual(hintEl.innerHTML, '');
    });
    test('does not show hint when hidden ratio is below threshold (false positive guard)', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        for (let i = 0; i < 10; i++) {
            allLines.push({ type: 'line', sourcePath: i < 6 ? '/other.dart' : '/w/x.dart' });
        }
        api.setScopeLevel('file');
        assert.strictEqual(hintEl.style.display, 'none');
        assert.ok(!hintEl.innerHTML.includes('Reset to All logs'));
    });
    test('shows reset when most lines are scope-hidden under active narrowing', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        for (let i = 0; i < 10; i++) {
            allLines.push({ type: 'line', sourcePath: '/z/other.dart' });
        }
        api.setScopeLevel('file');
        assert.ok(hintEl.innerHTML.includes('Reset to All logs'));
        assert.ok(hintEl.style.display !== 'none');
    });
    test('shows no-path guidance when enough lines lack sourcePath and hide-unattrib is off', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        api.setScopeHideUnattrib(false);
        for (let i = 0; i < 10; i++) {
            allLines.push({
                type: 'line',
                sourcePath: i < 7 ? null : '/w/x.dart',
            });
        }
        api.setScopeLevel('file');
        assert.ok(hintEl.innerHTML.includes('no debugger file path'));
    });
    test('does not show no-path guidance when hide-unattrib is on (false positive guard)', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        api.setScopeHideUnattrib(true);
        for (let i = 0; i < 10; i++) {
            allLines.push({
                type: 'line',
                sourcePath: i < 7 ? null : '/w/x.dart',
            });
        }
        api.setScopeLevel('file');
        assert.ok(!hintEl.innerHTML.includes('no debugger file path'));
    });
    test('clears hint when widening scope to all after active narrowing', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        for (let i = 0; i < 10; i++) {
            allLines.push({ type: 'line', sourcePath: '/z/other.dart' });
        }
        api.setScopeLevel('file');
        assert.ok(hintEl.innerHTML.includes('Reset to All logs'));
        api.setScopeLevel('all');
        assert.strictEqual(hintEl.style.display, 'none');
        assert.strictEqual(hintEl.innerHTML, '');
    });
    test('hint reset button sets scope to all', () => {
        const { allLines, api, hintEl } = createScopeHintRuntime();
        api.setActiveFilePath('/w/x.dart');
        for (let i = 0; i < 10; i++) {
            allLines.push({ type: 'line', sourcePath: '/z/other.dart' });
        }
        api.setScopeLevel('file');
        assert.ok(hintEl.innerHTML.includes('data-scope-reset="all"'));
        const btn = {
            closest(sel) {
                return sel === '[data-scope-reset="all"]' ? btn : null;
            },
        };
        api.fireHintClick(btn);
        assert.strictEqual(api.getScopeLevel(), 'all');
    });
});
//# sourceMappingURL=viewer-scope-filter-hint.test.js.map