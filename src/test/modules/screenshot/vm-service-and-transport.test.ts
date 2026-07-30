import * as assert from 'node:assert';
import { toVmServiceWsUri, recordVmServiceUriFromLogLine, getLatestVmServiceWsUri, clearVmServiceUris } from '../../../modules/screenshot/vm-service-uri';
import { parseScreenshotReply } from '../../../modules/screenshot/vm-service-screenshot';
import { makeCaptureTransport } from '../../../modules/screenshot/screenshot-transport';

suite('toVmServiceWsUri', () => {
    test('should convert the announced http URI to its ws form', () => {
        assert.strictEqual(toVmServiceWsUri('http://127.0.0.1:52999/abc123=/'), 'ws://127.0.0.1:52999/abc123=/ws');
        assert.strictEqual(toVmServiceWsUri('http://127.0.0.1:52999/abc123='), 'ws://127.0.0.1:52999/abc123=/ws');
        assert.strictEqual(toVmServiceWsUri('ws://127.0.0.1:52999/abc123=/ws'), 'ws://127.0.0.1:52999/abc123=/ws');
    });
});

suite('recordVmServiceUriFromLogLine', () => {
    teardown(() => clearVmServiceUris());

    test('should register the ws URI from the Flutter console banner', () => {
        const hit = recordVmServiceUriFromLogLine(
            'A Dart VM Service on sdk gphone64 x86 64 is available at: http://127.0.0.1:33417/abcDEF123=/',
            'd:/reports/test.log',
        );
        assert.strictEqual(hit, true);
        assert.strictEqual(getLatestVmServiceWsUri(), 'ws://127.0.0.1:33417/abcDEF123=/ws');
    });

    test('should register the ws URI from the Dart-Code "Connecting to" console line', () => {
        // The ONLY VM Service line real contacts sessions emit (2026-07-28/29 logs) — the
        // "is available at" banner never appears, and the URL is already ws://.
        const hit = recordVmServiceUriFromLogLine(
            'Connecting to VM Service at ws://127.0.0.1:56443/e3arVY258sw=/ws',
            'd:/reports/contacts.log',
        );
        assert.strictEqual(hit, true);
        assert.strictEqual(getLatestVmServiceWsUri(), 'ws://127.0.0.1:56443/e3arVY258sw=/ws');
    });

    test('should ignore ordinary log lines and URLs without the banner lead-in', () => {
        assert.strictEqual(recordVmServiceUriFromLogLine('GET http://127.0.0.1:8080/api ok', 'd:/reports/test.log'), false);
        assert.strictEqual(recordVmServiceUriFromLogLine('plain output line', 'd:/reports/test.log'), false);
        assert.strictEqual(getLatestVmServiceWsUri(), undefined);
    });

    test('should reject non-loopback hosts (SSRF guard on echoed text)', () => {
        // An app echoing attacker-influenced text must not be able to route captures off-machine.
        assert.strictEqual(recordVmServiceUriFromLogLine(
            'Connecting to VM Service at ws://evil.example.com:9999/x=/ws', 'd:/reports/test.log'), false);
        assert.strictEqual(recordVmServiceUriFromLogLine(
            'A Dart VM Service is available at: http://10.0.0.5:8181/tok=/', 'd:/reports/test.log'), false);
        assert.strictEqual(getLatestVmServiceWsUri(), undefined);
    });
});

suite('makeCaptureTransport', () => {
    function harness(vmBehavior: 'ok' | 'notFound' | 'timeout') {
        const calls = { vm: 0, adb: 0 };
        const logs: string[] = [];
        const capture = makeCaptureTransport({
            vm: () => {
                calls.vm++;
                if (vmBehavior === 'ok') { return Promise.resolve(new Uint8Array([1])); }
                return Promise.reject(new Error(vmBehavior === 'notFound'
                    ? '_flutter.screenshot failed: Method not found (the _flutter.screenshot VM extension is unavailable — this Flutter version may have removed it)'
                    : 'VM Service screenshot timed out after 5000ms'));
            },
            adb: () => { calls.adb++; return Promise.resolve(new Uint8Array([2])); },
            log: (m) => logs.push(m),
        });
        return { capture, calls, logs };
    }

    test('should use the VM result when the extension still exists', async () => {
        const h = harness('ok');
        assert.deepStrictEqual([...(await h.capture('ws://a'))], [1]);
        assert.deepStrictEqual(h.calls, { vm: 1, adb: 0 });
    });

    test('should switch permanently to adb for a URI after method-not-found', async () => {
        const h = harness('notFound');
        assert.deepStrictEqual([...(await h.capture('ws://a'))], [2]);
        assert.deepStrictEqual([...(await h.capture('ws://a'))], [2]);
        // VM probed exactly once for this URI; the switch is logged once.
        assert.deepStrictEqual(h.calls, { vm: 1, adb: 2 });
        assert.strictEqual(h.logs.filter((l) => l.includes('switching to adb')).length, 1);
        // A new URI (new run) probes the VM again.
        await h.capture('ws://b');
        assert.strictEqual(h.calls.vm, 2);
    });

    test('should fall back to adb on transient VM failure but keep probing the VM', async () => {
        const h = harness('timeout');
        assert.deepStrictEqual([...(await h.capture('ws://a'))], [2]);
        assert.deepStrictEqual([...(await h.capture('ws://a'))], [2]);
        assert.deepStrictEqual(h.calls, { vm: 2, adb: 2 });
    });

    test('memo holds ONE dead URI: interleaving two dead sessions re-probes (documented limitation)', async () => {
        // Single-string memo, matching the single-active-session design of getLatestVmServiceWsUri.
        // Pinned so a future multi-session effort knows this behavior was intentional, not a bug.
        const h = harness('notFound');
        await h.capture('ws://a'); // a dead, memoized
        await h.capture('ws://b'); // b dead, overwrites the memo
        await h.capture('ws://a'); // a re-probed (memo lost) — 3 VM calls total
        assert.strictEqual(h.calls.vm, 3);
        assert.strictEqual(h.calls.adb, 3);
    });
});

suite('parseScreenshotReply', () => {
    /** Full 8-byte PNG signature — the parser now magic-checks replies before accepting. */
    const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    test('should decode a valid reply for our id', () => {
        const png = Buffer.from(PNG_MAGIC).toString('base64');
        const [err, bytes, ours] = parseScreenshotReply(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { type: 'Screenshot', screenshot: png } }));
        assert.strictEqual(err, undefined);
        assert.strictEqual(ours, true);
        assert.deepStrictEqual([...(bytes ?? [])], PNG_MAGIC);
    });

    test('should tolerate one level of result nesting (private-API drift guard)', () => {
        const png = Buffer.from(PNG_MAGIC).toString('base64');
        const [err, bytes, ours] = parseScreenshotReply(JSON.stringify({ id: '1', result: { result: { screenshot: png } } }));
        assert.strictEqual(err, undefined);
        assert.strictEqual(ours, true);
        assert.deepStrictEqual([...(bytes ?? [])], PNG_MAGIC);
    });

    test('should reject non-PNG payloads (endpoint handing back arbitrary bytes)', () => {
        const notPng = Buffer.from('this is not an image, honest').toString('base64');
        const [err, , ours] = parseScreenshotReply(JSON.stringify({ id: '1', result: { screenshot: notPng } }));
        assert.ok(err && err.message.includes('not a PNG'));
        assert.strictEqual(ours, true);
    });

    test('should name the removed-API failure mode on method-not-found', () => {
        const [err] = parseScreenshotReply(JSON.stringify({ id: '1', error: { message: 'Method not found' } }));
        assert.ok(err && err.message.includes('unavailable'));
    });

    test('should ignore stream events and other ids', () => {
        assert.strictEqual(parseScreenshotReply(JSON.stringify({ method: 'streamNotify', params: {} }))[2], false);
        assert.strictEqual(parseScreenshotReply(JSON.stringify({ id: '2', result: {} }))[2], false);
    });

    test('should surface RPC errors and missing payloads', () => {
        const [err1, , ours1] = parseScreenshotReply(JSON.stringify({ id: '1', error: { message: 'no rasterizer' } }));
        assert.ok(err1 && err1.message.includes('no rasterizer'));
        assert.strictEqual(ours1, true);
        const [err2] = parseScreenshotReply(JSON.stringify({ id: '1', result: {} }));
        assert.ok(err2);
        const [err3, , ours3] = parseScreenshotReply('not json');
        assert.ok(err3);
        assert.strictEqual(ours3, true);
    });
});
