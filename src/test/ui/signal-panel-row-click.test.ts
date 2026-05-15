/**
 * Tests that the signal panel's "All signals" row carries enough data to drive a precise
 * fingerprint-based jump, and that the generated webview script wires up the round-trip
 * (click → openSessionForSignalType payload, host → scrollToSignal, webview helper).
 *
 * These pin the contract that fixed dead-click behavior in the Signals sidebar (cross-session
 * trend rows used to post only `signalType`, which the host could never resolve correctly).
 */

import * as assert from 'node:assert';
import { getSignalScriptPartB } from '../../ui/panels/viewer-signal-panel-script-part-b';
import { getSignalScriptPartD } from '../../ui/panels/viewer-signal-panel-script-part-d';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';

suite('Signal panel row → session jump wiring', () => {

    test('row HTML carries fingerprint + detail + signal-type data attributes', () => {
        const script = getSignalScriptPartB(90);
        assert.ok(
            script.includes('data-signal-type="\' + esc(s.kind)'),
            'row must expose s.kind as data-signal-type for host fallback resolution',
        );
        assert.ok(
            script.includes('data-fingerprint="\' + esc(s.fingerprint)'),
            'row must expose s.fingerprint so the host can resolve to a specific session',
        );
        assert.ok(
            script.includes('data-detail="\' + esc(s.detail || \'\')'),
            'row must expose s.detail (raw example) for substring-based line scroll',
        );
    });

    test('row click posts fingerprint + label + detail alongside signalType', () => {
        const script = getSignalScriptPartD();
        assert.ok(script.includes("type: 'openSessionForSignalType'"), 'click posts the expected message type');
        assert.ok(script.includes('signalType: row.dataset.signalType'), 'payload carries signalType');
        assert.ok(
            script.includes("fingerprint: row.dataset.fingerprint || ''"),
            'payload carries fingerprint (the key fix vs. kind-only routing)',
        );
        assert.ok(script.includes("label: row.dataset.label || ''"), 'payload carries label');
        assert.ok(script.includes("detail: row.dataset.detail || ''"), 'payload carries detail');
    });

    test('signalScrollToLabel helper is exposed on window for the main viewer message bus', () => {
        const script = getSignalScriptPartD();
        assert.ok(
            script.includes('window.signalScrollToLabel = function(label, detail)'),
            'helper must be window-scoped so viewer-script-messages.ts can call it',
        );
        assert.ok(
            script.includes('pulseLinesAround(foundIdx)'),
            'helper must reuse pulseLinesAround for the visual confirmation pulse',
        );
        /* The label tokenizer must split on placeholder tokens like <N>/<TS> rather than
           per-character — the earlier version split('') and never found a run longer than 1 char. */
        assert.ok(
            script.includes('label.split(/<\\w+>/)'),
            'label tokenizer must split on placeholder boundaries, not per-character',
        );
    });

    test('main viewer message bus routes scrollToSignal to the panel-script helper', () => {
        const script = getViewerScriptMessageHandler();
        assert.ok(script.includes("case 'scrollToSignal'"), 'main message bus must handle scrollToSignal');
        assert.ok(
            script.includes('window.signalScrollToLabel(msg.label'),
            'scrollToSignal handler must delegate to signalScrollToLabel',
        );
    });
});
