import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleCrashlyticsScript } from '../../ui/viewer-search-filter/viewer-trouble-crashlytics';

/**
 * Trouble Mode Crashlytics band (Stage 5) — remote-data escaping.
 *
 * Issue titles/subtitles/ids come from the Crashlytics cache (remote data) and are
 * concatenated into innerHTML AND into data-* attributes. This pins that both sinks
 * are entity-escaped so a hostile issue title cannot inject markup or break out of an
 * attribute — the one XSS surface in the feature.
 */
function loadScript(): Record<string, unknown> {
  // The trailing IIFE guards on `document`, so it is safe to run without a DOM.
  const ctx = vm.createContext({ vt: (_k: string, a: unknown, b: unknown) => String(a) + ' ' + String(b) });
  vm.runInContext(getTroubleCrashlyticsScript(), ctx, { filename: 'trouble-crashlytics.js' });
  return ctx as Record<string, unknown>;
}

suite('Trouble Mode Crashlytics band — row HTML escaping', () => {
  test('escapes a hostile issue title in both text content and attributes', () => {
    const ctx = loadScript();
    const rowHtml = ctx.troubleCrashlyticsRowHtml as (r: unknown) => string;
    const html = rowHtml({
      id: 'x"1', title: '<img src=x onerror=alert(1)>', subtitle: 'a"b',
      events: '5', users: '2', fatal: true, kind: '', state: 'OPEN', fv: '', lv: '',
    });
    // Visible text: angle brackets neutralized, no live tag.
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'title escaped as text');
    assert.ok(!html.includes('<img'), 'no raw <img tag survives');
    // Attributes: a double-quote must become an entity so it cannot close the attribute.
    assert.ok(html.includes('data-id="x&quot;1"'), 'quote in id escaped in attribute');
    assert.ok(html.includes('a&quot;b'), 'quote in subtitle escaped in attribute');
  });
});
