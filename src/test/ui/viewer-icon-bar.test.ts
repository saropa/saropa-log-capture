import * as assert from 'node:assert';
import { getIconBarHtml, getIconBarScript } from '../../ui/viewer-nav/viewer-icon-bar';

suite('ViewerIconBar', () => {

    suite('getIconBarHtml', () => {
        test('should return toolbar with icon-bar id and aria-label', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('id="icon-bar"'));
            assert.ok(html.includes('role="toolbar"'));
            assert.ok(html.includes('aria-label="Log viewer tools"'));
        });

        test('should include title for label toggle discoverability', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('show or hide icon labels'));
        });

        test('should include optional labels for each icon', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('class="ib-label"'));
            assert.ok(html.includes('>Logs<'), 'Logs label should be present');
            assert.ok(html.includes('>Find in Files</span>'));
            assert.ok(!html.includes('id="ib-search"'), 'in-log search is session-nav only, not an icon bar tool');
            assert.ok(html.includes('>Bookmarks<'), 'Bookmarks label should be present');
            assert.ok(html.includes('>Options</span>'));
        });

        test('should include separator and main icon buttons', () => {
            const html = getIconBarHtml();
            assert.ok(html.includes('class="ib-separator"'));
            assert.ok(html.includes('id="ib-sessions"'));
            assert.ok(html.includes('id="ib-options"'));
            assert.ok(html.includes('id="ib-about"'));
            assert.ok(!html.includes('id="ib-compress"'), 'compress is a log-pane display toggle, not an activity bar tool');
        });

        test('should not include replay in icon bar (replay is footer + log overlay only)', () => {
            const html = getIconBarHtml();
            assert.ok(!html.includes('id="ib-replay"'));
            assert.ok(!html.includes('>Replay</span>'));
        });

        test('should not render a count badge on the Logs icon', () => {
            /* Regression guard: the Logs badge plateaued at "99+" for any project with real
               history, so it conveyed no information. Removed deliberately — re-adding would
               just bring back permanent visual noise. The session count is shown inside the
               panel header instead. */
            const html = getIconBarHtml();
            assert.ok(!html.includes('id="ib-sessions-badge"'), 'Logs badge span must not be present');
            assert.ok(!html.includes('id="ib-sessions-count"'), 'Logs inline-count span must not be present');
        });

        test('should have action-oriented tooltips on all icon buttons', () => {
            const html = getIconBarHtml();
            const ids = [
                'ib-sessions', 'ib-find', 'ib-bookmarks',
                'ib-sql-query-history', 'ib-trash', 'ib-options',
                'ib-crashlytics', 'ib-signal', 'ib-about',
            ];
            for (const id of ids) {
                const match = html.match(new RegExp(`id="${id}"[^>]*title="([^"]*)"`));
                assert.ok(match, `${id} must have a title attribute`);
                assert.ok(
                    match![1].startsWith('Click to open/close'),
                    `${id} tooltip should describe click action, got: "${match![1]}"`,
                );
            }
        });
    });

    suite('getIconBarScript', () => {
        test('should persist and restore label visibility via webview state', () => {
            const script = getIconBarScript();
            assert.ok(script.includes('iconBarLabelsVisible'));
            assert.ok(script.includes('getState'));
            assert.ok(script.includes('setState'));
        });

        test('should toggle labels on bar click, not on icon button click', () => {
            const script = getIconBarScript();
            assert.ok(script.includes('ib-icon'));
            assert.ok(script.includes('applyLabelsVisible'));
        });

        test('should define ensureSignalSlideoutOpen that skips toggle when signal already active', () => {
            const script = getIconBarScript();
            assert.ok(script.includes('ensureSignalSlideoutOpen'));
            // When signal is already active, it must NOT call setActivePanel (which toggles off)
            // Instead it calls openSignalPanel directly — verify both branches exist
            assert.ok(
                script.includes("activePanel === 'signal'"),
                'must check whether signal is already the active panel',
            );
            assert.ok(
                script.includes("setActivePanel('signal')"),
                'must delegate to setActivePanel when signal is not active',
            );
        });
    });
});
