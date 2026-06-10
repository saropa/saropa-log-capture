import * as assert from 'assert';
import { getAboutPanelHtml, getAboutPanelScript } from '../../ui/viewer-panels/viewer-about-panel';
import { getAboutPanelStyles } from '../../ui/viewer-styles/viewer-styles-about';

/**
 * About panel: long-press title to copy, a changelog link that opens
 * CHANGELOG.md markdown-rendered in the log viewer, and collapsible sections.
 *
 * Why these are pinned as integration-style string assertions: the webview
 * script is generated as a TS template literal and concatenated into a single
 * `<script>` tag at runtime, so the only practical way to catch regressions in
 * the embedded JS without booting a webview is to assert on its source. Each
 * check pins the **intent** (the gesture wiring, the changelog hand-off to the
 * viewer, the collapse toggle) not a brittle implementation detail.
 *
 * History: the changelog was previously rendered inline as markdown inside the
 * panel. Commit 64d8d030 moved it into the log viewer (markdown view), so the
 * tests below assert the link hand-off, not an in-panel formatter.
 */
suite('Viewer about panel', () => {

    test('html exposes long-press target and changelog viewer link', () => {
        const html = getAboutPanelHtml();
        // Long-press target id must be present for the script to wire mousedown/touchstart.
        assert.ok(html.includes('id="ab-title-row"'), 'title row needs the long-press anchor id');
        // Tooltip is the only discovery hint before the user presses — keep it stable.
        assert.ok(html.includes('Press and hold to copy'), 'title row needs the gesture hint');
        // Changelog link id is what the click handler and message handler target; the
        // changelog opens in the log viewer rather than rendering inline in the panel.
        assert.ok(html.includes('id="about-changelog-link"'), 'changelog link id is the viewer hand-off target');
        // The link carries its target URI in data-uri (filled in by the message handler).
        assert.ok(/id="about-changelog-link"[^>]*data-uri=/.test(html), 'changelog link exposes a data-uri slot');
    });

    test('script wires long-press copy of "<label> <badge>" with toast', () => {
        const src = getAboutPanelScript();
        // Press timer must fire ~500ms — the threshold matches the mobile long-press
        // convention and avoids stealing accidental drag-clicks inside the panel.
        assert.ok(/setTimeout\([^,]+,\s*500\)/.test(src), 'long-press fires at 500ms');
        // Mouse + touch both wired (covers VS Code Desktop and vscode.dev / Web).
        assert.ok(src.includes("addEventListener('mousedown', startTitlePress)"), 'mousedown bound');
        assert.ok(src.includes("addEventListener('touchstart', startTitlePress"), 'touchstart bound');
        // Cancellation paths must exist or a stuck pressArmed=true would fire after release.
        assert.ok(src.includes("addEventListener('mouseup', cancelTitlePress)"), 'mouseup cancels');
        assert.ok(src.includes("addEventListener('mouseleave', cancelTitlePress)"), 'mouseleave cancels');
        // Copy uses the established copyToClipboard postMessage protocol.
        assert.ok(src.includes("type: 'copyToClipboard'"), 'posts copyToClipboard');
        // Toast reuses the global helper from viewer-copy.ts — the prefix lets the user
        // see exactly what landed on the clipboard. The "Copied: {0}" message is now
        // localized via vt() (webview-l10n bridge, plan 053).
        assert.ok(src.includes("showCopyToast(vt('viewer.about.copied', text))"), 'toast confirms copied text via vt()');
    });

    test('script hands the changelog to the log viewer and stores its uri', () => {
        const src = getAboutPanelScript();
        // The message handler stashes the changelog URI on the link so a later click
        // can open it; without this the link has no target and the open is a no-op.
        assert.ok(src.includes('e.data.changelogUriString'), 'message handler reads changelogUriString');
        assert.ok(src.includes('about-changelog-link'), 'script targets the changelog link element');
        // Clicking the link opens CHANGELOG.md in the log viewer (markdown view) via the
        // openSessionFromPanel protocol — replacing the old inline markdown formatter.
        assert.ok(src.includes("type: 'openSessionFromPanel'"), 'changelog click posts openSessionFromPanel');
        // No inline markdown formatting survives in the panel — the viewer owns rendering now.
        assert.ok(!src.includes('formatAboutMarkdown'), 'no inline markdown formatter remains');
        assert.ok(!src.includes('ab-md-'), 'no inline markdown output classes remain');
    });

    test('script wires collapsible sections (toggle + keyboard parity)', () => {
        const src = getAboutPanelScript();
        // Every section header is a collapse/expand toggle; the handler flips the body
        // and chevron. Click and keyboard (Enter/Space) must both route through it.
        assert.ok(src.includes('toggleAboutSection'), 'section toggle handler present');
        assert.ok(src.includes('ab-section-toggle'), 'section headers carry the toggle class');
        assert.ok(src.includes("e.key !== 'Enter'"), 'keyboard parity for section headers (Enter/Space)');
    });

    test('styles hint the long-press affordance and define section/changelog chrome', () => {
        const css = getAboutPanelStyles();
        // Long-press target gets cursor:pointer and user-select:none so a drag doesn't
        // compete with the press timer.
        assert.ok(/\.ab-version-row\b[^{]*\{[^}]*cursor:\s*pointer/.test(css), '.ab-version-row hints clickable');
        assert.ok(/\.ab-version-row\b[^{]*\{[^}]*user-select:\s*none/.test(css), '.ab-version-row suppresses drag-select');
        // Pressing-state opacity dip is the only feedback before the toast fires.
        assert.ok(css.includes('.ab-title-pressing'), 'press state class present');
        // The changelog is now a link into the viewer, styled as such.
        assert.ok(css.includes('.ab-changelog-link'), '.ab-changelog-link style is defined');
        // Collapsible section chrome: the toggle header and its hidden-body class.
        assert.ok(css.includes('.ab-section-toggle'), '.ab-section-toggle style is defined');
        assert.ok(css.includes('.ab-section-body-hidden'), '.ab-section-body-hidden style is defined');
    });
});
