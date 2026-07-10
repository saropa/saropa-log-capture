import * as assert from 'node:assert';
import { buildTroubleReportMarkdown } from '../../ui/signals/signal-report-markdown';

/**
 * Trouble Mode Copy Report (Stage 6) — the Markdown payload builder.
 *
 * Contract: severity + only the environment fields that exist + the exact fault lines,
 * with NO surrounding nominal lines, and a code fence sized so a fault line that itself
 * contains a backtick run cannot break out of the block (export hygiene, commit 585d966b).
 */
suite('Trouble Mode Copy Report — buildTroubleReportMarkdown', () => {
  test('includes severity, present environment fields, and the fault lines', () => {
    const md = buildTroubleReportMarkdown({
      severityLabel: 'Error',
      faultLines: ['ERROR connection refused', '#0 main (package:app/main.dart:42)'],
      appVersion: '1.2.3',
      debugAdapterType: 'dartFlutter',
      debugTarget: 'device',
    });
    assert.ok(md.includes('**Severity:** Error'), 'severity');
    assert.ok(md.includes('**App version:** 1.2.3'), 'app version');
    assert.ok(md.includes('**Debug adapter:** dartFlutter'), 'debug adapter');
    assert.ok(md.includes('**Debug target:** device'), 'debug target');
    assert.ok(md.includes('ERROR connection refused'), 'fault message');
    assert.ok(md.includes('#0 main (package:app/main.dart:42)'), 'stack frame');
  });

  test('omits environment fields that are absent', () => {
    const md = buildTroubleReportMarkdown({ severityLabel: 'Warning', faultLines: ['W something'] });
    assert.ok(!md.includes('App version'), 'no app version line');
    assert.ok(!md.includes('Debug adapter'), 'no adapter line');
    assert.ok(!md.includes('Debug target'), 'no target line');
    assert.ok(md.includes('**Severity:** Warning'));
  });

  test('sizes the fence to outrun a backtick run inside the content', () => {
    const md = buildTroubleReportMarkdown({ severityLabel: 'Error', faultLines: ['see ```code``` here'] });
    const lines = md.split('\n');
    assert.ok(lines.includes('````'), 'uses a 4-backtick fence when content has ```');
    assert.ok(!lines.includes('```'), 'never a 3-backtick fence line that the content could match');
  });
});
