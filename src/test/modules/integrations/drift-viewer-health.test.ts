import * as assert from 'assert';
import { fetchDriftViewerHealth } from '../../../modules/integrations/drift-viewer-health';

suite('drift-viewer-health', () => {
  let origFetch: typeof globalThis.fetch;

  setup(() => {
    origFetch = globalThis.fetch;
  });

  teardown(() => {
    globalThis.fetch = origFetch;
  });

  test('fetchDriftViewerHealth returns ok and version on 200 JSON', async () => {
    globalThis.fetch = (async (url: unknown) => {
      assert.ok(String(url).includes('/api/health'));
      return {
        ok: true,
        json: async () => ({ ok: true, version: '2.10.0', extensionConnected: false }),
      } as Response;
    }) as typeof fetch;

    const r = await fetchDriftViewerHealth('http://127.0.0.1:8642');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.version, '2.10.0');
    assert.strictEqual(r.extensionConnected, false);
  });

  test('fetchDriftViewerHealth strips trailing slash before /api/health', async () => {
    let seen = '';
    globalThis.fetch = (async (url: unknown) => {
      seen = String(url);
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }) as typeof fetch;

    await fetchDriftViewerHealth('http://127.0.0.1:8642/');
    assert.strictEqual(seen, 'http://127.0.0.1:8642/api/health');
  });

  test('fetchDriftViewerHealth returns ok false on HTTP error', async () => {
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as Response) as typeof fetch;

    const r = await fetchDriftViewerHealth('http://127.0.0.1:8642');
    assert.strictEqual(r.ok, false);
    assert.ok(r.error?.includes('503'), r.error);
  });

  test('fetchDriftViewerHealth returns ok false on network failure', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const r = await fetchDriftViewerHealth('http://127.0.0.1:9');
    assert.strictEqual(r.ok, false);
    assert.ok(r.error?.includes('ECONNREFUSED'), r.error);
  });
});
