/**
 * Tests for the tri-state tier filter in viewer-stack-filter.ts.
 *
 * The filter has three modes per tier: 'all' (show everything),
 * 'warnplus' (show only warnings and errors), and 'none' (hide everything).
 * Device-critical items always bypass the filter regardless of mode.
 *
 * Defaults: Flutter DAP = 'all', Device = 'warnplus', External = 'warnplus'.
 *
 * Tests exercise isTierHidden() by evaluating the generated script and
 * calling the function with various item shapes.
 */
import * as assert from 'assert';
import { getStackFilterScript } from '../../ui/viewer-stack-tags/viewer-stack-filter';

/**
 * Build a sandbox function that evaluates the stack filter script and runs
 * a test callback with access to the filter functions and state variables.
 *
 * The callback receives helpers: setShowFlutter, setShowDevice, setShowExternal, isTierHidden.
 */
function buildSandbox(testBody: string): () => unknown {
    /* Stubs for recalcHeights and renderViewport — called by setShow* */
    const stubs = `
        var recalcCalled = 0;
        function recalcHeights() { recalcCalled++; }
        function renderViewport() {}
    `;
    const script = stubs + getStackFilterScript() + testBody;
    return new Function(script) as () => unknown;
}

suite('viewer-stack-filter tri-state', () => {
    suite('default state', () => {
        test('should default Flutter DAP to all, Device to warnplus, External to warnplus', () => {
            const result = buildSandbox(`return { f: showFlutter, d: showDevice, e: showExternal };`)();
            assert.deepStrictEqual(result, { f: 'all', d: 'warnplus', e: 'warnplus' });
        });
    });

    suite('isTierHidden — all mode', () => {
        test('should show flutter lines when showFlutter is all (default)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'flutter', level: 'info' });
            `)();
            assert.strictEqual(hidden, false);
        });

        test('should show device-other lines when showDevice is all', () => {
            const hidden = buildSandbox(`
                setShowDevice('all');
                return isTierHidden({ tier: 'device-other', level: 'debug' });
            `)();
            assert.strictEqual(hidden, false);
        });

        test('should show external lines when showExternal is all', () => {
            const hidden = buildSandbox(`
                setShowExternal('all');
                return isTierHidden({ tier: 'external', level: 'debug' });
            `)();
            assert.strictEqual(hidden, false);
        });
    });

    suite('isTierHidden — none mode', () => {
        test('should hide flutter lines when showFlutter is none', () => {
            const hidden = buildSandbox(`
                setShowFlutter('none');
                return isTierHidden({ tier: 'flutter', level: 'error' });
            `)();
            assert.strictEqual(hidden, true);
        });

        test('should hide device-other lines when showDevice is none', () => {
            const hidden = buildSandbox(`
                setShowDevice('none');
                return isTierHidden({ tier: 'device-other', level: 'warning' });
            `)();
            assert.strictEqual(hidden, true);
        });

        test('should hide external lines when showExternal is none', () => {
            const hidden = buildSandbox(`
                setShowExternal('none');
                return isTierHidden({ tier: 'external', level: 'error' });
            `)();
            assert.strictEqual(hidden, true);
        });
    });

    suite('isTierHidden — warnplus mode', () => {
        test('should show error lines in warnplus mode (device)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'error' });
            `)();
            assert.strictEqual(hidden, false);
        });

        test('should show warning lines in warnplus mode (device)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'warning' });
            `)();
            assert.strictEqual(hidden, false);
        });

        test('should hide info lines in warnplus mode (device)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'info' });
            `)();
            assert.strictEqual(hidden, true);
        });

        test('should hide debug lines in warnplus mode (device)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'debug' });
            `)();
            assert.strictEqual(hidden, true);
        });

        test('should use originalLevel over level when present (demoted device-other error)', () => {
            /* Device-other errors are demoted to info for display but keep
               originalLevel = 'error' — warnplus must surface them. */
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'info', originalLevel: 'error' });
            `)();
            assert.strictEqual(hidden, false,
                'demoted device-other error should be visible in warnplus mode');
        });

        test('should use originalLevel over level when present (demoted device-other warning)', () => {
            const hidden = buildSandbox(`
                return isTierHidden({ tier: 'device-other', level: 'info', originalLevel: 'warning' });
            `)();
            assert.strictEqual(hidden, false,
                'demoted device-other warning should be visible in warnplus mode');
        });

        test('should work for flutter tier in warnplus mode', () => {
            const results = buildSandbox(`
                setShowFlutter('warnplus');
                return {
                    error: isTierHidden({ tier: 'flutter', level: 'error' }),
                    warning: isTierHidden({ tier: 'flutter', level: 'warning' }),
                    info: isTierHidden({ tier: 'flutter', level: 'info' }),
                    debug: isTierHidden({ tier: 'flutter', level: 'debug' }),
                };
            `)() as Record<string, boolean>;
            assert.strictEqual(results.error, false, 'flutter error should be visible');
            assert.strictEqual(results.warning, false, 'flutter warning should be visible');
            assert.strictEqual(results.info, true, 'flutter info should be hidden');
            assert.strictEqual(results.debug, true, 'flutter debug should be hidden');
        });

        test('should filter external tier in warnplus mode (default)', () => {
            const results = buildSandbox(`
                return {
                    error: isTierHidden({ tier: 'external', level: 'error' }),
                    warning: isTierHidden({ tier: 'external', level: 'warning' }),
                    info: isTierHidden({ tier: 'external', level: 'info' }),
                    debug: isTierHidden({ tier: 'external', level: 'debug' }),
                };
            `)() as Record<string, boolean>;
            assert.strictEqual(results.error, false, 'external error should be visible');
            assert.strictEqual(results.warning, false, 'external warning should be visible');
            assert.strictEqual(results.info, true, 'external info should be hidden in warnplus');
            assert.strictEqual(results.debug, true, 'external debug should be hidden in warnplus');
        });
    });

    suite('isTierHidden — device-critical bypass', () => {
        test('should always show device-critical regardless of showDevice mode', () => {
            const results = buildSandbox(`
                return {
                    none: (function() { setShowDevice('none'); return isTierHidden({ tier: 'device-critical', level: 'info' }); })(),
                    warnplus: (function() { setShowDevice('warnplus'); return isTierHidden({ tier: 'device-critical', level: 'info' }); })(),
                    all: (function() { setShowDevice('all'); return isTierHidden({ tier: 'device-critical', level: 'info' }); })(),
                };
            `)() as Record<string, boolean>;
            assert.strictEqual(results.none, false, 'device-critical must be visible in none mode');
            assert.strictEqual(results.warnplus, false, 'device-critical must be visible in warnplus mode');
            assert.strictEqual(results.all, false, 'device-critical must be visible in all mode');
        });
    });

    suite('isTierHidden — no tier', () => {
        test('should show items without a tier property', () => {
            const hidden = buildSandbox(`
                setShowFlutter('none');
                setShowDevice('none');
                setShowExternal('none');
                return isTierHidden({ level: 'info' });
            `)();
            assert.strictEqual(hidden, false, 'items without tier should never be hidden');
        });
    });

    suite('setShowFlutter / setShowDevice / setShowExternal', () => {
        test('should not call recalcHeights when mode is unchanged', () => {
            /* showFlutter defaults to 'all' — calling setShowFlutter('all') should no-op */
            const count = buildSandbox(`
                setShowFlutter('all');
                return recalcCalled;
            `)();
            assert.strictEqual(count, 0, 'recalcHeights should not fire for no-op mode change');
        });

        test('should call recalcHeights when mode changes', () => {
            const count = buildSandbox(`
                setShowFlutter('warnplus');
                return recalcCalled;
            `)();
            assert.strictEqual(count, 1, 'recalcHeights should fire once when mode changes');
        });

        test('should not call recalcHeights when External mode is unchanged', () => {
            /* showExternal defaults to 'warnplus' */
            const count = buildSandbox(`
                setShowExternal('warnplus');
                return recalcCalled;
            `)();
            assert.strictEqual(count, 0, 'recalcHeights should not fire for no-op external change');
        });
    });
});
