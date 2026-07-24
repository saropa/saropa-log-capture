import * as assert from 'assert';
import { describe, it } from 'mocha';
import { processOutputEvent, type OutputEventDeps, type OutputEventTarget } from '../../../modules/session/session-manager-events';
import type { LogSession } from '../../../modules/capture/log-session';
import type { DapOutputBody } from '../../../modules/capture/tracker';
import { getConfig } from '../../../modules/config/config';

/** Build OutputEventDeps with the given enabled flag and an empty session map. */
function makeDeps(enabled: boolean, earlyBuffer: unknown): OutputEventDeps {
    return {
        sessions: new Map<string, LogSession>(),
        earlyBuffer: earlyBuffer as never,
        config: { ...getConfig(), enabled } as ReturnType<typeof getConfig>,
        exclusionRules: [],
        floodGuard: { check: () => ({ allow: true }) } as never,
        spamSuppressor: { check: () => ({ allow: true }), flush: () => null, reset: () => {} } as never,
    };
}

/** Minimal target — the kill-switch cases return before broadcasting. */
function makeTarget(): OutputEventTarget {
    return {
        counters: { categoryCounts: {}, floodSuppressedTotal: 0 },
        broadcastLine: () => {},
    };
}

const body: DapOutputBody = { category: 'console', output: 'hello world\n' } as DapOutputBody;

describe('processOutputEvent kill switch', () => {

    it('should NOT buffer an unknown-session event when capture is disabled', () => {
        // Records add() calls; the disabled gate must sit above earlyBuffer.add so no per-event
        // work (buffering, string trimming) happens while the kill switch is off.
        let added = 0;
        const earlyBuffer = { add: () => { added += 1; } };
        processOutputEvent(makeDeps(false, earlyBuffer), makeTarget(), 'unknown-session', body);
        assert.strictEqual(added, 0, 'earlyBuffer.add must not be called when capture is disabled');
    });

    it('should NOT broadcast a known-session event when capture is disabled', () => {
        // The top gate must short-circuit the known-session branch too, not only the unknown-session
        // one — a session already in the map must produce no append/broadcast while the switch is off.
        let broadcasts = 0;
        const earlyBuffer = { add: () => {} };
        const deps = makeDeps(false, earlyBuffer);
        (deps.sessions as Map<string, LogSession>).set('known-session', {
            appendLine: () => {}, lineCount: 0, fileUri: { fsPath: '/x' },
        } as unknown as LogSession);
        const target = makeTarget();
        target.broadcastLine = () => { broadcasts += 1; };
        processOutputEvent(deps, target, 'known-session', body);
        assert.strictEqual(broadcasts, 0, 'no broadcast may occur for a known session when disabled');
    });

    it('should buffer an unknown-session event when capture is enabled', () => {
        // Sanity check the ordering did not break the normal early-buffer path: with capture on,
        // an event for a session that has not finished init is still buffered.
        let added = 0;
        const earlyBuffer = { add: () => { added += 1; } };
        processOutputEvent(makeDeps(true, earlyBuffer), makeTarget(), 'unknown-session', body);
        assert.strictEqual(added, 1, 'earlyBuffer.add must buffer the event when capture is enabled');
    });
});
