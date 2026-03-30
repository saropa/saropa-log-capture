import * as assert from 'assert';
import { getContinuationScript } from '../../ui/viewer/viewer-data-add-continuation';

suite('Continuation line collapsing', () => {
    test('should produce valid JavaScript', () => {
        const script = getContinuationScript();
        assert.doesNotThrow(() => new Function(script), 'continuation script should parse without syntax errors');
    });

    test('should define all expected state variables', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('var activeContHeader = null'));
        assert.ok(script.includes('var nextContGroupId = 0'));
        assert.ok(script.includes('var contHeaderMap = {}'));
        assert.ok(script.includes('var contMaxChildren = 200'));
        assert.ok(script.includes('var contAutoCollapseThreshold = 5'));
        assert.ok(script.includes('var lastNormalLineForCont = null'));
    });

    test('should define all expected functions', () => {
        const script = getContinuationScript();
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
        const script = getContinuationScript();
        assert.ok(script.includes('item.timestamp == null'));
        assert.ok(script.includes('prev.timestamp == null'));
    });

    test('should enforce max children limit', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('activeContHeader.contChildCount < contMaxChildren'));
    });

    test('should skip separators from continuation detection', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('lineItem.isSeparator'));
    });

    test('finalizeContinuationGroup should adjust totalHeight when auto-collapsing', () => {
        const script = getContinuationScript();
        assert.ok(script.includes('totalHeight -= allLines[ci].height'), 'should subtract child heights from totalHeight on auto-collapse');
    });

    test('expandContinuationForSearch should call recalcHeights after expanding', () => {
        const script = getContinuationScript();
        const fnBody = script.substring(script.indexOf('function expandContinuationForSearch'));
        assert.ok(fnBody.includes('recalcHeights'), 'should recalc after search-expand');
    });
});
