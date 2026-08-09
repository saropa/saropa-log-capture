import * as assert from 'assert';
import { flowMapScript } from '../../../ui/panels/flow-map-panel-script';
import { flowMapZoomScript } from '../../../ui/panels/flow-map-panel-zoom-script';
import { flowMapDragScript } from '../../../ui/panels/flow-map-panel-drag-script';
import { flowMapReplayScript } from '../../../ui/panels/flow-map-panel-replay-script';
import { flowMapLightboxScript } from '../../../ui/panels/flow-map-panel-lightbox-script';

/**
 * Every flow-map panel script is generated as a TypeScript template literal whose CONTENT is
 * JavaScript that runs in the webview — `tsc` validates the outer `.ts` file, never the JS text
 * inside the string, and every other test in this suite only regex-matches substrings of that text.
 * Neither catches an actual JS syntax error: a single un-doubled backslash escape (`\n` instead of
 * `\\n`) inside one of these template literals is consumed by TypeScript at BUILD time and lands as
 * a literal newline inside a single-quoted JS string at RUNTIME — a hard SyntaxError that silently
 * kills the entire `<script>` tag (every button, every listener, everything it defines) with nothing
 * but a webview-devtools console line to show for it. That exact bug shipped a full round of review
 * and 279 passing tests before a live F5 session ever ran the code.
 *
 * `new Function(js)` parses (without executing) the extracted script body exactly the way a browser
 * would before running it — the cheapest fully-faithful proof available outside a real webview.
 */
suite('FlowMap panel scripts — generated JS actually parses', () => {

    /** Pulls the JS out of a `<script nonce="...">...</script>` wrapper. */
    function scriptBody(html: string): string {
        const m = /<script[^>]*>([\s\S]*)<\/script>/.exec(html);
        assert.ok(m, 'the generator emitted a <script> tag');
        return m![1];
    }

    const generators: [string, () => string][] = [
        ['flowMapScript', () => flowMapScript('n')],
        ['flowMapZoomScript', () => flowMapZoomScript('n')],
        ['flowMapDragScript', () => flowMapDragScript('n')],
        ['flowMapReplayScript', () => flowMapReplayScript('n')],
        ['flowMapLightboxScript', () => flowMapLightboxScript('n', {
            title: 't', captured: 't', trigger: 't', screen: 't', logLine: 't', close: 't',
            counter: 't', counterScreen: 't', file: 't', copyPath: 't', zoom: 't', zoomHint: 't',
            unavailable: 't', prev: 't', next: 't', compare: 't', comparePrev: 't', compareNext: 't',
            compareSession: 't', compareThisSession: 't', compareLoading: 't', compareNoMatch: 't',
        }, [])],
    ];

    for (const [name, build] of generators) {
        test(`${name}'s output is valid JavaScript`, () => {
            const js = scriptBody(build());
            try {
                new Function(js);
            } catch (err) {
                assert.fail(`${name} produced a JS syntax error: ${(err as Error).message}`);
            }
        });
    }
});
