/**
 * Pins the Signal panel's single-mechanism string contract: every user-facing string in the panel
 * scripts flows through the panel-standalone SignalScriptStrings object (injected as SIGNAL_STRINGS and
 * filled by fillSignalString), and NONE go through the global vt('viewer.signal…') map.
 *
 * This guards the consolidation that unified three prior mechanisms (SIGNAL_STRINGS plus the
 * viewer.signalPanel.* and viewer.signal.* vt() namespaces) into one. A regression — e.g. a new row
 * affordance wired with vt() — would reintroduce the split and is caught here.
 */

import * as assert from 'node:assert';
import { getSignalPanelScriptContent } from '../../ui/panels/viewer-signal-panel-script';

suite('Signal panel string mechanism', () => {
    const script = getSignalPanelScriptContent('signal.panel.test');

    test('defines the standalone placeholder-fill helper', () => {
        assert.ok(
            script.includes('function fillSignalString(tpl, a0, a1, a2)'),
            'fillSignalString helper must be present in the assembled script',
        );
    });

    test('renders strings through SIGNAL_STRINGS, not vt()', () => {
        // The folded affordances and section summaries read off the injected object.
        for (const field of ['SIGNAL_STRINGS.accept', 'SIGNAL_STRINGS.heroErrors',
            'SIGNAL_STRINGS.cooccurTitle', 'SIGNAL_STRINGS.allSummary', 'SIGNAL_STRINGS.timeMinAgo']) {
            assert.ok(script.includes(field), `${field} must be referenced in the panel scripts`);
        }
    });

    test('contains no global vt() lookups for signal strings', () => {
        assert.ok(
            !/vt\('viewer\.signal/.test(script),
            'signal panel must not reach into the global vt() map — folded into SIGNAL_STRINGS',
        );
    });

    test('injects the folded fields into the SIGNAL_STRINGS payload', () => {
        // The host serializes the resolved strings as JSON ahead of the scripts.
        assert.ok(script.includes('"accept":"Accept"'), 'accept label must be injected');
        assert.ok(script.includes('"heroErrors":"Errors: {0}"'), 'hero error template must be injected');
        assert.ok(script.includes('"cooccurTitle":"{0} and {1} co-occur in {2} sessions"'),
            'co-occurrence template must be injected');
    });
});
