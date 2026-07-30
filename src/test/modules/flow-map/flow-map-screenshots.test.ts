import * as assert from 'assert';
import { formatClock, joinShotsToScreens, type ShotWithDataUri } from '../../../modules/flow-map/flow-map-screenshots';
import { buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import type { TimelineEvent } from '../../../modules/flow-map/flow-map-model';

/** A minimal nav/reached event, defaults chosen so tests only set what they're asserting on. */
function ev(kind: TimelineEvent['kind'], label: string, logLine: number): TimelineEvent {
    return { tsMs: 0, clock: '00:00:00', kind, label, logLine };
}

/** A minimal sidecar+dataUri entry, defaults chosen so tests only set what they're asserting on. */
function shot(logLine: number, overrides: Partial<ShotWithDataUri> = {}): ShotWithDataUri {
    return { trigger: 'error', timestamp: 0, logLine, text: 'boom', dataUri: 'data:image/png;base64,AA==', ...overrides };
}

suite('FlowMap screenshots join (Phase E, plan 117)', () => {

    suite('joinShotsToScreens', () => {
        test('should pick the LAST preceding nav/reached event as the screen active at capture time', () => {
            const events = [ev('nav', 'Home', 1), ev('nav', 'Contact View', 5), ev('nav', 'Settings', 12)];
            const shots = joinShotsToScreens([shot(8)], events);
            assert.strictEqual(shots[0].screenLabel, 'Contact View');
        });

        test('should treat "reached" as node-creating same as "nav"', () => {
            const events = [ev('nav', 'Home', 1), ev('reached', 'Favorites Tab', 4)];
            const shots = joinShotsToScreens([shot(6)], events);
            assert.strictEqual(shots[0].screenLabel, 'Favorites Tab');
        });

        test('should leave screenLabel undefined for logLine 0 (unanchored manual capture)', () => {
            const events = [ev('nav', 'Home', 1)];
            const shots = joinShotsToScreens([shot(0)], events);
            assert.strictEqual(shots[0].screenLabel, undefined);
        });

        test('should leave screenLabel undefined when the capture precedes any node-creating event', () => {
            const events = [ev('nav', 'Home', 10)];
            const shots = joinShotsToScreens([shot(3)], events);
            assert.strictEqual(shots[0].screenLabel, undefined);
        });

        test('should ignore non-node-creating event kinds when choosing the active screen', () => {
            const events = [ev('nav', 'Home', 1), ev('action', 'Favorite', 3), ev('nav', 'Contact View', 5)];
            const shots = joinShotsToScreens([shot(4)], events);
            assert.strictEqual(shots[0].screenLabel, 'Home');
        });

        test('should carry the data URI, trigger, log line, and text through unchanged', () => {
            const shots = joinShotsToScreens([shot(2, { trigger: 'nav', text: 'Screen Navigation: Settings' })], []);
            assert.strictEqual(shots[0].dataUri, 'data:image/png;base64,AA==');
            assert.strictEqual(shots[0].trigger, 'nav');
            assert.strictEqual(shots[0].logLine, 2);
            assert.strictEqual(shots[0].text, 'Screen Navigation: Settings');
        });
    });

    suite('formatClock', () => {
        test('should format epoch-ms to a zero-padded local HH:MM:SS clock', () => {
            const d = new Date();
            d.setHours(8, 5, 9, 0);
            assert.strictEqual(formatClock(d.getTime()), '08:05:09');
        });
    });

    suite('screenshots section rendering', () => {
        const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
        const nav = (clock: string, name: string) => `[${clock}.000] [console] [log] Screen Navigation: ${name}`;
        const lines = [...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Contact View')];

        test('should render figures with data-line and the omitted-count note when shots are given', () => {
            const parsed = parseLog(lines);
            const graph = buildGraph(parsed);
            const shots = joinShotsToScreens([shot(2, { trigger: 'error' })], parsed.events);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 3 });
            assert.ok(html.includes('sec-shots'), 'renders the Screenshots section');
            assert.ok(html.includes('data-line="2"'), 'thumbnail carries the log-line anchor');
            assert.ok(html.includes('shot-fig'), 'renders a figure per shot');
            assert.ok(/\+3 more/.test(html), 'renders the omitted-count note');
        });

        test('should omit data-line for an unanchored (logLine 0) capture', () => {
            const parsed = parseLog(lines);
            const graph = buildGraph(parsed);
            const shots = joinShotsToScreens([shot(0)], parsed.events);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.ok(!html.includes('data-line="0"'), 'no data-line attribute for an unanchored shot');
        });

        test('should render nothing at all — no section, no TOC entry — when there are no screenshots', () => {
            const parsed = parseLog(lines);
            const graph = buildGraph(parsed);
            const html = buildFlowMapBody(parsed, graph);
            assert.ok(!html.includes('sec-shots'), 'no Screenshots section without screenshots');
        });
    });
});
