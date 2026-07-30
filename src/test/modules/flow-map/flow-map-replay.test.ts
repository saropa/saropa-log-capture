import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';

/** Minimal walked session: enough for the diagram to render a real toolbar + at least one node. */
const FIXTURE: readonly string[] = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    'Project:        demo',
    '[08:00:01.000] [console] [log] [flowmap] enter screen "Home" lib/views/home.dart:1',
    '[08:00:05.000] [console] [log] [flowmap] enter screen "Settings" lib/views/settings.dart:1',
];

// The Replay button is a static markup + l10n concern here — the step-through animation itself runs
// in the webview at runtime and is not unit-testable from this Extension Host test file.
suite('FlowMap Replay button', () => {
    const graph = buildGraph(parseLog(FIXTURE));

    test('the main report toolbar includes a replay control', () => {
        const body = buildFlowMapBody(parseLog(FIXTURE), graph);
        assert.ok(body.includes('data-zoom="replay"'), 'replay control present in the report');
    });

    test('the pop-out diagram-only body also includes the replay control', () => {
        const body = buildFlowDiagramBody(graph);
        assert.ok(body.includes('data-zoom="replay"'), 'replay control present in the pop-out');
    });
});
