import { logExtensionWarn } from '../../modules/misc/extension-logger';
import { flowMapScript } from './flow-map-panel-script';
import { flowMapZoomScript } from './flow-map-panel-zoom-script';
import { flowMapDragScript } from './flow-map-panel-drag-script';
import { flowMapReplayScript } from './flow-map-panel-replay-script';
import { flowMapLightboxScript } from './flow-map-panel-lightbox-script';

/** Pulls the JS out of a `<script nonce="...">...</script>` wrapper, mirroring the test harness. */
function scriptBody(html: string): string | undefined {
    const m = /<script[^>]*>([\s\S]*)<\/script>/.exec(html);
    return m?.[1];
}

const LIGHTBOX_LABELS = {
    title: 't', captured: 't', trigger: 't', screen: 't', logLine: 't', close: 't',
    counter: 't', counterScreen: 't', file: 't', copyPath: 't', zoom: 't', zoomHint: 't',
    unavailable: 't', prev: 't', next: 't', compare: 't', comparePrev: 't', compareNext: 't',
    compareSession: 't', compareThisSession: 't', compareLoading: 't', compareNoMatch: 't',
};

/**
 * The canonical list of flow-map panel script generators, in one place — both this module's
 * activation self-check AND `flow-map-panel-scripts-parse.test.ts`'s regression test import this
 * SAME array, so a sixth script added to only one of them is a compile error, not a silently
 * uncovered gap (the prior version hand-duplicated this list in both files "kept in sync manually",
 * with nothing enforcing that claim).
 */
export const FLOW_MAP_PANEL_SCRIPT_GENERATORS: readonly [string, () => string][] = [
    ['flowMapScript', () => flowMapScript('n')],
    ['flowMapZoomScript', () => flowMapZoomScript('n')],
    ['flowMapDragScript', () => flowMapDragScript('n')],
    ['flowMapReplayScript', () => flowMapReplayScript('n')],
    ['flowMapLightboxScript', () => flowMapLightboxScript('n', LIGHTBOX_LABELS, [])],
];

/**
 * Re-runs the `new Function(js)` parse check the test suite runs — against the REAL runtime-built
 * script strings, at activation — and warns to the output channel if one fails.
 *
 * The v9.3.10 zoom regression (a single un-doubled `\n` inside a template literal, valid TypeScript
 * but a hard JS SyntaxError once generated) shipped through review, 339 passing tests, and a tagged
 * release before anyone noticed — nothing short of parsing the actual generated string catches that
 * class of bug, and the test suite alone only catches it on the NEXT `npm test` run, not at build or
 * install time. This surfaces the same signal without needing a live F5 session first.
 *
 * Never throws or blocks activation — matches `maybeNotifyPartialNlsCoverage` /
 * `maybeNotifySkipNearDuplicatesDefaultChanged`'s contract. Silent on success; this is a developer
 * diagnostic; there is nothing for an end user to act on.
 */
export function selfCheckFlowMapPanelScripts(): void {
    try {
        for (const [name, build] of FLOW_MAP_PANEL_SCRIPT_GENERATORS) {
            const js = scriptBody(build());
            if (js === undefined) {
                logExtensionWarn('flowMapPanelScriptsSelfCheck', `${name} did not emit a <script> tag`);
                continue;
            }
            try {
                new Function(js);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logExtensionWarn('flowMapPanelScriptsSelfCheck', `${name} produced invalid JavaScript: ${msg}`);
            }
        }
    } catch (err) {
        // Any generator throwing outright (not just producing bad JS) is equally a build-time signal
        // worth surfacing, but must never take activation down with it — including if the logging
        // call itself throws (e.g. a disposed output channel during shutdown).
        const msg = err instanceof Error ? err.message : String(err);
        try {
            logExtensionWarn('flowMapPanelScriptsSelfCheck', `self-check failed to run: ${msg}`);
        } catch { /* never let logging itself break the never-throws contract */ }
    }
}
