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

/**
 * Pins the per-signal "Copy" action that emits a paste-ready detail block (metadata + raw
 * example + full supporting log lines) for an analysis engine. Both signal lists carry the
 * button; both click handlers intercept it before their own row action so it never falls
 * through to open-session / jump-to-line.
 */
suite('Signal panel per-signal copy', () => {

    test('both signal renderers emit a copy button keyed by fingerprint + label', () => {
        const script = getSignalScriptPartB(90);
        const copyButtons = script.match(/class="re-action signal-copy-btn"/g) || [];
        assert.strictEqual(
            copyButtons.length, 2,
            'copy button must appear in both renderSignalTrends and renderSignalsInThisLog',
        );
        assert.ok(
            script.includes("data-fingerprint=\"' + esc(s.fingerprint || '')"),
            'in-log row + its copy button must expose a fingerprint (empty-safe) for re-lookup',
        );
        assert.ok(
            script.includes("data-label=\"' + esc(s.label)"),
            'copy button must expose the label as a fallback key when fingerprint is absent',
        );
    });

    test('part D defines the detail-builder helpers used by the copy action', () => {
        const script = getSignalScriptPartD();
        assert.ok(script.includes('function buildSignalDetailText(s)'), 'detail builder must exist');
        assert.ok(script.includes('function collectSignalEvidenceLines(s)'), 'evidence collector must exist');
        assert.ok(script.includes('function findSignalByKey(arr, fp, label)'), 'key-based finder must exist');
        /* The detail block must carry the actual log evidence, not just the normalized label —
           that is the whole point of the per-signal copy vs. the label-only panel markdown. */
        assert.ok(script.includes('### Supporting log lines'), 'detail block includes supporting log lines');
        assert.ok(
            script.includes('li.rawText != null ? li.rawText'),
            'evidence uses untruncated rawText (falls back to stripTags only for collapsed rows)',
        );
    });

    test('both click handlers intercept the copy button before their own row action', () => {
        const script = getSignalScriptPartD();
        assert.ok(
            script.includes('copySignalFromButton(copyBtn, signalDataCache.allSignals)'),
            'trend handler copies from the cross-session cache',
        );
        assert.ok(
            script.includes('copySignalFromButton(copyBtn, signalDataCache.signalsInThisLog)'),
            'in-log handler copies from the this-log cache',
        );
        assert.ok(
            script.includes("type: 'copyToClipboard'"),
            'copy routes through the existing copyToClipboard host message',
        );
    });

    /* Backtick-escaping in the markdown code fences (\\\`\\\`\\\`) is easy to get wrong inside a
       template literal — a stray backslash or unescaped backtick produces malformed JS that
       compiles fine (it is just a string) but throws at runtime in the webview. Parse the
       generated fragment as a function body to prove it is syntactically valid JS. */
    test('generated part B + part D fragments are syntactically valid JS', () => {
        assert.doesNotThrow(() => new Function(getSignalScriptPartB(90)), 'part B must parse as JS');
        assert.doesNotThrow(() => new Function(getSignalScriptPartD()), 'part D must parse as JS');
    });
});

/**
 * Pins the "click to see detail" affordance for summary signals (e.g. the Drift Advisor issues
 * classified signal) that carry a detail string but no lineIndices. Before this, a non-jumpable
 * in-log row had no click behavior and its detail was never shown — clicking did nothing. Such
 * rows now toggle an inline detail body; jump-to-line rows are unaffected.
 */
suite('Signal panel summary-signal detail toggle', () => {

    test('non-jumpable in-log rows with a detail become detail-toggle rows', () => {
        const script = getSignalScriptPartB(90);
        /* A row is jumpable only when it has lineIndices; otherwise a detail makes it a toggle row.
           This branch is the gate that fixed the dead-click on "Drift Advisor issues". */
        assert.ok(
            script.includes("jumpable ? ' signal-jumpable' : (hasDetail ? ' signal-detail-toggle' : '')"),
            'in-log row class must fall back to signal-detail-toggle when it has a detail but no line',
        );
        assert.ok(
            script.includes("'<div class=\"signal-detail-body\" hidden>'"),
            'a hidden inline detail body must be emitted for non-jumpable detail rows',
        );
        assert.ok(
            script.includes("' — click to see detail'"),
            'the row title must advertise the click-to-see-detail affordance',
        );
    });

    test('in-log click handler toggles the detail body and intercepts copy first', () => {
        const script = getSignalScriptPartD();
        /* Copy must be checked before the jump/toggle branches so the button never also toggles. */
        const copyIdx = script.indexOf("copySignalFromButton(copyBtn, signalDataCache.signalsInThisLog)");
        const toggleIdx = script.indexOf("e.target.closest('.signal-detail-toggle')");
        assert.ok(copyIdx !== -1, 'in-log handler must handle the copy button');
        assert.ok(toggleIdx !== -1, 'in-log handler must handle detail-toggle rows');
        assert.ok(copyIdx < toggleIdx, 'copy interception must come before the detail-toggle branch');
        assert.ok(
            script.includes('body.hidden = !body.hidden') && script.includes("classList.toggle('signal-detail-open'"),
            'clicking a detail-toggle row flips the body hidden state and the open class',
        );
    });
});
