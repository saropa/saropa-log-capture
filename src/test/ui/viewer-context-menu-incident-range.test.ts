import * as assert from 'node:assert';
import {
    computeIncidentRange,
    effectiveErrorWarningLevel,
} from '../../ui/viewer-context-menu/viewer-context-menu-incident-range';

suite('ViewerContextMenuIncidentRange', () => {
    test('effectiveErrorWarningLevel respects originalLevel for demoted device lines', () => {
        assert.strictEqual(effectiveErrorWarningLevel({ type: 'line', level: 'info', originalLevel: 'error' }), 'error');
        assert.strictEqual(effectiveErrorWarningLevel({ type: 'line', level: 'info' }), null);
        assert.strictEqual(effectiveErrorWarningLevel({ type: 'marker' }), null);
    });

    test('expands to all adjacent error/warning lines until level breaks (different messages)', () => {
        const lines = [
            { type: 'line', level: 'info', html: 'before' },
            { type: 'line', level: 'error', html: 'first' },
            { type: 'line', level: 'warning', html: 'second' },
            { type: 'line', level: 'error', html: 'third' },
            { type: 'line', level: 'info', html: 'after' },
        ];
        assert.deepStrictEqual(computeIncidentRange(lines, 1), { lo: 1, hi: 3 });
        assert.deepStrictEqual(computeIncidentRange(lines, 2), { lo: 1, hi: 3 });
        assert.deepStrictEqual(computeIncidentRange(lines, 3), { lo: 1, hi: 3 });
    });

    test('stops at info so band does not cross unrelated lines', () => {
        const lines = [
            { type: 'line', level: 'error', html: 'e1' },
            { type: 'line', level: 'info', html: 'gap' },
            { type: 'line', level: 'error', html: 'e2' },
        ];
        assert.deepStrictEqual(computeIncidentRange(lines, 0), { lo: 0, hi: 0 });
        assert.deepStrictEqual(computeIncidentRange(lines, 2), { lo: 2, hi: 2 });
    });

    test('consecutive duplicate errors stay one band (adjacent EW)', () => {
        const lines = [
            { type: 'line', level: 'info', html: 'x' },
            { type: 'line', level: 'error', html: 'SameError' },
            { type: 'line', level: 'error', html: 'SameError' },
            { type: 'line', level: 'error', html: 'SameError' },
            { type: 'line', level: 'info', html: 'after' },
        ];
        const r = computeIncidentRange(lines, 2);
        assert.deepStrictEqual(r, { lo: 1, hi: 3 });
    });

    test('merges stack group and preceding message line', () => {
        const lines = [
            { type: 'line', level: 'warning', html: 'msg' },
            { type: 'stack-header', level: 'warning', html: 'hdr', groupId: 1 },
            { type: 'stack-frame', level: 'warning', html: 'fr', groupId: 1 },
        ];
        assert.deepStrictEqual(computeIncidentRange(lines, 0), { lo: 0, hi: 2 });
        assert.deepStrictEqual(computeIncidentRange(lines, 1), { lo: 0, hi: 2 });
        assert.deepStrictEqual(computeIncidentRange(lines, 2), { lo: 0, hi: 2 });
    });

    test('merges continuation group members', () => {
        const lines = [
            { type: 'line', level: 'error', html: 'a', contGroupId: 9 },
            { type: 'line', level: 'error', html: 'b', contGroupId: 9 },
            { type: 'line', level: 'error', html: 'c', contGroupId: 9 },
        ];
        assert.deepStrictEqual(computeIncidentRange(lines, 1), { lo: 0, hi: 2 });
    });

    test('returns null when no error or warning appears in merged range', () => {
        const lines = [
            { type: 'line', level: 'info', html: 'only' },
            { type: 'stack-header', level: 'info', html: 'h', groupId: 3 },
            { type: 'stack-frame', level: 'info', html: 'f', groupId: 3 },
        ];
        assert.strictEqual(computeIncidentRange(lines, 1), null);
    });

    test('merges full Flutter banner when stdout body lines are info (render overflow dump)', () => {
        const lines = [
            { type: 'line', level: 'error', bannerGroupId: 7, bannerRole: 'header' },
            { type: 'line', level: 'info', bannerGroupId: 7, bannerRole: 'body' },
            { type: 'line', level: 'info', bannerGroupId: 7, bannerRole: 'body' },
            { type: 'line', level: 'info', bannerGroupId: 7, bannerRole: 'body' },
            { type: 'line', level: 'error', bannerGroupId: 7, bannerRole: 'footer' },
        ];
        assert.deepStrictEqual(computeIncidentRange(lines, 2), { lo: 0, hi: 4 });
        assert.deepStrictEqual(computeIncidentRange(lines, 0), { lo: 0, hi: 4 });
    });
});
