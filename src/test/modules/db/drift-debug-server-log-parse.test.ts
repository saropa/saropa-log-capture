import * as assert from 'assert';
import {
  createDriftDebugServerLogAccumulator,
  extractDriftViewerHttpUrl,
  isDriftDebugServerBannerLine,
  stripAsciiBoxNoise,
} from '../../../modules/db/drift-debug-server-log-parse';

suite('drift-debug-server-log-parse', () => {
  test('extractDriftViewerHttpUrl finds URL inside ASCII box line', () => {
    const line = '      │              http://127.0.0.1:8642               │';
    assert.strictEqual(extractDriftViewerHttpUrl(line), 'http://127.0.0.1:8642');
  });

  // Drift v3.3.3 wraps the URL in rounded-corner frames; earlier stripping
  // hand-picked a subset and missed ╭╮╰╯, so the URL couldn't be matched.
  test('extractDriftViewerHttpUrl handles rounded-corner frame chars', () => {
    const line = '╰ http://127.0.0.1:8642 ╯';
    assert.strictEqual(extractDriftViewerHttpUrl(line), 'http://127.0.0.1:8642');
  });

  test('extractDriftViewerHttpUrl handles heavy-frame chars', () => {
    const line = '┃ http://127.0.0.1:8642 ┃';
    assert.strictEqual(extractDriftViewerHttpUrl(line), 'http://127.0.0.1:8642');
  });

  test('stripAsciiBoxNoise removes full box-drawing block', () => {
    assert.strictEqual(stripAsciiBoxNoise('╭──╮ hello ╰──╯'), 'hello');
    assert.strictEqual(stripAsciiBoxNoise('┏━━┓ world ┗━━┛'), 'world');
    assert.strictEqual(stripAsciiBoxNoise('├──┤ divider ├──┤'), 'divider');
  });

  test('accumulator emits after banner + URL lines', () => {
    const acc = createDriftDebugServerLogAccumulator();
    assert.strictEqual(acc.push('╭──╮'), null);
    assert.strictEqual(
      acc.push('│           DRIFT DEBUG SERVER   v2.10.0           │'),
      null,
    );
    assert.strictEqual(acc.push('├──────────────────────────────────────────────────┤'), null);
    assert.strictEqual(acc.push('│      Open in browser to view your database:      │'), null);
    const det = acc.push('      │              http://127.0.0.1:8642               │');
    assert.ok(det);
    assert.strictEqual(det!.baseUrl, 'http://127.0.0.1:8642');
    assert.strictEqual(det!.version, '2.10.0');
  });

  test('URL without banner in ring yields null', () => {
    const acc = createDriftDebugServerLogAccumulator();
    assert.strictEqual(acc.push('      │              http://127.0.0.1:8642               │'), null);
  });

  test('isDriftDebugServerBannerLine', () => {
    assert.strictEqual(isDriftDebugServerBannerLine('DRIFT DEBUG SERVER v1.0.0'), true);
    assert.strictEqual(isDriftDebugServerBannerLine('SELECT 1'), false);
  });
});
