import * as assert from 'node:assert';
import {
    ADB_LOGCAT_ADAPTER_ID,
    EXPLAIN_WITH_AI_ADAPTER_ID,
    SCREENSHOTS_ADAPTER_ID,
    mergeIntegrationAdaptersForWebview,
    stripUiOnlyIntegrationAdapterIds,
} from '../../../modules/integrations/integration-adapter-constants';

suite('integration-adapter-constants', () => {
    test('stripUiOnlyIntegrationAdapterIds removes explainWithAi only (NOT adbLogcat)', () => {
        assert.deepStrictEqual(stripUiOnlyIntegrationAdapterIds(['packages', 'git']), ['packages', 'git']);
        assert.deepStrictEqual(
            stripUiOnlyIntegrationAdapterIds(['packages', EXPLAIN_WITH_AI_ADAPTER_ID, 'git']),
            ['packages', 'git'],
        );
        assert.deepStrictEqual(stripUiOnlyIntegrationAdapterIds([EXPLAIN_WITH_AI_ADAPTER_ID]), []);
        // adbLogcat survives the strip: the config READ path needs the explicit force entry.
        assert.deepStrictEqual(
            stripUiOnlyIntegrationAdapterIds(['packages', ADB_LOGCAT_ADAPTER_ID]),
            ['packages', ADB_LOGCAT_ADAPTER_ID],
        );
    });

    test('mergeIntegrationAdaptersForWebview appends explainWithAi when AI enabled', () => {
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], false, false, false),
            ['packages'],
        );
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], true, false, false),
            ['packages', EXPLAIN_WITH_AI_ADAPTER_ID],
        );
    });

    test('mergeIntegrationAdaptersForWebview strips stray explainWithAi from session list before merge', () => {
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', EXPLAIN_WITH_AI_ADAPTER_ID], true, false, false),
            ['packages', EXPLAIN_WITH_AI_ADAPTER_ID],
        );
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', EXPLAIN_WITH_AI_ADAPTER_ID], false, false, false),
            ['packages'],
        );
    });

    test('mergeIntegrationAdaptersForWebview reflects adbLogcat from its boolean, not the array', () => {
        // Enabled -> adbLogcat appears in the displayed (checkbox) list.
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], false, true, false),
            ['packages', ADB_LOGCAT_ADAPTER_ID],
        );
        // Disabled -> adbLogcat is dropped even if it lingers in the array (checkbox shows off).
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', ADB_LOGCAT_ADAPTER_ID], false, false, false),
            ['packages'],
        );
        // Order: session base, then adbLogcat, then explainWithAi.
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], true, true, false),
            ['packages', ADB_LOGCAT_ADAPTER_ID, EXPLAIN_WITH_AI_ADAPTER_ID],
        );
    });

    test('mergeIntegrationAdaptersForWebview reflects screenshots from its boolean, not the array (plan 114)', () => {
        // Enabled -> screenshots appears in the displayed (checkbox) list.
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], false, false, true),
            ['packages', SCREENSHOTS_ADAPTER_ID],
        );
        // Disabled -> screenshots is dropped even if it lingers in the array (checkbox shows off).
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages', SCREENSHOTS_ADAPTER_ID], false, false, false),
            ['packages'],
        );
        // Order: session base, adbLogcat, screenshots, explainWithAi.
        assert.deepStrictEqual(
            mergeIntegrationAdaptersForWebview(['packages'], true, true, true),
            ['packages', ADB_LOGCAT_ADAPTER_ID, SCREENSHOTS_ADAPTER_ID, EXPLAIN_WITH_AI_ADAPTER_ID],
        );
    });
});
