import * as assert from 'assert';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';

type HintElStub = {
    innerHTML: string;
    style: { display: string };
    _handler: ((e: { target: unknown }) => void) | null;
    addEventListener: (ev: string, fn: (e: { target: unknown }) => void) => void;
    removeAttribute: (name: string) => void;
};

/** Minimal DOM + globals to evaluate the injected scope-filter script for hint behavior. */
function createScopeHintRuntime(): {
    hintEl: HintElStub;
    allLines: Array<{ type: string; sourcePath?: string | null; scopeFiltered?: boolean }>;
    api: {
        setActiveFilePath: (p: string | null) => void;
        setScopeHideUnattrib: (v: boolean) => void;
        getScopeLevel: () => string;
        applyScopeFilter: () => void;
        flushScopeFilterHint: () => void;
        setScopeLevel: (level: string) => void;
        fireHintClick: (target: { closest: (sel: string) => unknown }) => void;
    };
} {
    const hintEl: HintElStub = {
        innerHTML: '',
        style: { display: '' },
        _handler: null,
        addEventListener(ev: string, fn: (e: { target: unknown }) => void) {
            if (ev === 'click') {
                this._handler = fn;
            }
        },
        removeAttribute() {},
    };

    const allLines: Array<{ type: string; sourcePath?: string | null; scopeFiltered?: boolean }> = [];

    const factory = new Function(
        'hintStub',
        'linesRef',
        `
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
        ${getScopeFilterScript()}
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
        `,
    );

    const api = factory(hintEl, allLines) as {
        setActiveFilePath: (p: string | null) => void;
        setScopeHideUnattrib: (v: boolean) => void;
        getScopeLevel: () => string;
        applyScopeFilter: () => void;
        flushScopeFilterHint: () => void;
        setScopeLevel: (level: string) => void;
        fireHintClick: (target: { closest: (sel: string) => unknown }) => void;
    };

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
            closest(sel: string) {
                return sel === '[data-scope-reset="all"]' ? btn : null;
            },
        };
        api.fireHintClick(btn);
        assert.strictEqual(api.getScopeLevel(), 'all');
    });
});
