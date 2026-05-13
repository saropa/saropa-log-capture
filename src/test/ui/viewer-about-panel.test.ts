import * as assert from 'assert';
import { getAboutPanelHtml, getAboutPanelScript } from '../../ui/viewer-panels/viewer-about-panel';
import { getAboutPanelStyles } from '../../ui/viewer-styles/viewer-styles-about';

/**
 * About panel: long-press title to copy, formatted markdown changelog,
 * and selectable changelog text.
 *
 * Why these are pinned as integration-style string assertions: the webview
 * script is generated as a TS template literal and concatenated into a single
 * `<script>` tag at runtime, so the only practical way to catch regressions in
 * the embedded JS without booting a webview is to assert on its source. Each
 * check pins the **intent** (the gesture wiring, the formatter call, the
 * user-select opt-in) not a brittle implementation detail.
 */
suite('Viewer about panel', () => {

    test('html exposes long-press target and formatted changelog container', () => {
        const html = getAboutPanelHtml();
        // Long-press target id must be present for the script to wire mousedown/touchstart.
        assert.ok(html.includes('id="ab-title-row"'), 'title row needs the long-press anchor id');
        // Tooltip is the only discovery hint before the user presses — keep it stable.
        assert.ok(html.includes('Press and hold to copy'), 'title row needs the gesture hint');
        // Changelog container id is what the formatter targets in the message handler.
        assert.ok(html.includes('id="about-changelog"'), 'changelog container id is the formatter target');
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
        // see exactly what landed on the clipboard.
        assert.ok(src.includes("showCopyToast('Copied: ' + text)"), 'toast confirms copied text');
    });

    test('script formats markdown blocks (headings, bullets, hr) and inline (bold, italic, code, links)', () => {
        const src = getAboutPanelScript();
        // The formatter is invoked on the changelog payload — without this the rendering
        // silently falls back to nothing.
        assert.ok(src.includes('formatAboutMarkdown(e.data.changelogExcerpt)'), 'formatter wired into message handler');
        // Block-level outputs.
        assert.ok(src.includes('<div class="ab-md-h ab-md-h'), 'headings emit ab-md-h with level');
        assert.ok(src.includes('<hr class="ab-md-hr">'), 'horizontal rules emit ab-md-hr');
        assert.ok(src.includes('<ul class="ab-md-ul">'), 'bullets group into ab-md-ul');
        assert.ok(src.includes('<div class="ab-md-bq">'), 'blockquotes emit ab-md-bq');
        // Inline outputs.
        assert.ok(src.includes('<strong>$1</strong>'), 'bold replacement present');
        assert.ok(src.includes('<em>$1</em>'), 'italic replacement present');
        assert.ok(src.includes('ab-md-code'), 'inline code class present');
        // Security: links render as plain text (no href) — the Marketplace link above
        // the changelog is the single authorized external nav from this panel.
        assert.ok(src.includes('<span class="ab-md-link">$1</span>'), 'links render as plain text span');
        assert.ok(!/<a [^>]*href=\$2/.test(src), 'no clickable <a href=> emitted from markdown');
        // HTML must be escaped BEFORE inline substitution so a raw "<script>" in the
        // changelog cannot inject markup.
        assert.ok(src.includes('escapeAboutHtml'), 'escapes raw HTML before formatting');
    });

    test('styles opt the changelog into user-select:text and hint long-press affordance', () => {
        const css = getAboutPanelStyles();
        // Body's global user-select:none confines selection to #viewport; the changelog
        // and its descendants must opt back in or drag-select is dead in the panel.
        assert.ok(/\.ab-changelog\b[^{]*\{[^}]*user-select:\s*text/.test(css), '.ab-changelog re-enables text selection');
        assert.ok(/\.ab-changelog\s*,\s*\.ab-changelog\s*\*/.test(css), 'descendants also opt in');
        assert.ok(/\.ab-changelog\b[^{]*\{[^}]*cursor:\s*text/.test(css), 'cursor reinforces affordance');
        // Long-press target gets cursor:pointer and user-select:none so a drag doesn't
        // compete with the press timer.
        assert.ok(/\.ab-version-row\b[^{]*\{[^}]*cursor:\s*pointer/.test(css), '.ab-version-row hints clickable');
        assert.ok(/\.ab-version-row\b[^{]*\{[^}]*user-select:\s*none/.test(css), '.ab-version-row suppresses drag-select');
        // Pressing-state opacity dip is the only feedback before the toast fires.
        assert.ok(css.includes('.ab-title-pressing'), 'press state class present');
        // Markdown rendering styles must exist for the formatter's output classes.
        for (const cls of ['.ab-md-h1', '.ab-md-h2', '.ab-md-hr', '.ab-md-ul', '.ab-md-code', '.ab-md-link', '.ab-md-bq']) {
            assert.ok(css.includes(cls), `${cls} style is defined`);
        }
    });
});
