/**
 * About Saropa panel HTML and script for the webview.
 *
 * Displays company info, project links, and social links
 * in a slide-out panel following the icon-bar panel pattern.
 */

import { buildItemUrl } from "../../modules/marketplace-url";

/** Generate the about panel HTML with static content. */
export function getAboutPanelHtml(): string {
    return /* html */ `
<div id="about-panel" class="about-panel" role="region" aria-label="About Saropa">
    <div class="about-panel-header">
        <span>About Saropa</span>
        <button id="about-panel-close" class="about-panel-close" title="Close" aria-label="Close About"><span class="codicon codicon-close"></span></button>
    </div>
    <div class="about-panel-content">
        <div id="ab-title-row" class="ab-version-row" title="Press and hold to copy">
            <span class="ab-version-label">Saropa Log Capture</span>
            <span id="ab-version-badge" class="ab-version-badge"></span>
        </div>
        <p class="ab-tagline">Built for Resilience. Designed for Peace of Mind.</p>
        <p class="ab-blurb">A technology firm rooted in financial services and online security. We build digital safeguards\u2009\u2014\u2009developer extensions that just work and a crisis management platform trusted by 50,000+ users.</p>
        <div class="ab-section">Recent changes</div>
        <a id="about-changelog-link" href="#" class="ab-changelog-link" data-url="#">Full changelog on Marketplace</a>
        <div id="about-changelog" class="ab-changelog"><span class="ab-changelog-loading">Loading…</span></div>
        <div class="ab-section">Projects</div>
        ${getProjectLinksHtml()}
        <div class="ab-section">Connect</div>
        ${getConnectLinksHtml()}
    </div>
</div>`;
}

/** Generate the about panel script. */
export function getAboutPanelScript(): string {
    return /* js */ `
(function() {
    var aboutPanelEl = document.getElementById('about-panel');
    var aboutPanelOpen = false;

    window.openAboutPanel = function() {
        if (!aboutPanelEl) return;
        aboutPanelOpen = true;
        aboutPanelEl.classList.add('visible');
        injectVersion();
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'requestAboutContent' });
        requestAnimationFrame(function() {
            var first = aboutPanelEl.querySelector('button');
            if (first) first.focus();
        });
    };

    window.closeAboutPanel = function() {
        if (!aboutPanelEl) return;
        aboutPanelEl.classList.remove('visible');
        aboutPanelOpen = false;
        var cl = document.getElementById('about-changelog');
        if (cl) cl.innerHTML = '<span class="ab-changelog-loading">Loading\\u2026</span>';
        if (typeof clearActivePanel === 'function') clearActivePanel('about');
        var ibBtn = document.getElementById('ib-about');
        if (ibBtn) ibBtn.focus();
    };

    function injectVersion() {
        var toolbar = document.getElementById('viewer-toolbar');
        var ver = toolbar ? toolbar.getAttribute('data-version') : '';
        var badge = document.getElementById('ab-version-badge');
        if (badge && ver) badge.textContent = ver;
    }

    window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'aboutContent') return;
        var badge = document.getElementById('ab-version-badge');
        if (badge && e.data.version) badge.textContent = e.data.version;
        var chunk = document.getElementById('about-changelog');
        if (chunk) {
            /* WHY innerHTML: we render trusted CHANGELOG.md content through a
               minimal allowlist formatter (escapes raw HTML first, then re-inserts
               only known-safe spans/divs/strong/em/code/hr/ul/li). Using a <pre>
               with textContent would block bold/italic/headings — the user's whole
               ask for this change. */
            if (e.data.changelogExcerpt) {
                chunk.innerHTML = formatAboutMarkdown(e.data.changelogExcerpt);
            } else {
                chunk.textContent = 'Changelog unavailable.';
            }
        }
        var link = document.getElementById('about-changelog-link');
        if (link && e.data.changelogUrl) link.setAttribute('data-url', e.data.changelogUrl);
    });

    /* ---- Markdown formatter (CHANGELOG-scoped subset) ----
       Block-level: # headings (1–6), --- horizontal rules, - / * bullets,
       > blockquotes, blank lines collapse adjacent bullets. Inline: **bold**,
       *italic*, \`code\`, [text](url) (text only, links are not clickable here —
       the "Full changelog on Marketplace" link is the authorized exit point). */
    function formatAboutMarkdown(md) {
        var lines = String(md).split('\\n');
        var out = [];
        var inList = false;
        function flushList() { if (inList) { out.push('</ul>'); inList = false; } }
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var trimmed = line.replace(/\\s+$/, '');
            if (trimmed === '') { flushList(); continue; }
            if (/^\\s*(\\-{3,}|\\*{3,}|_{3,})\\s*$/.test(trimmed)) { flushList(); out.push('<hr class="ab-md-hr">'); continue; }
            var h = /^(#{1,6})\\s+(.*)$/.exec(trimmed);
            if (h) { flushList(); out.push('<div class="ab-md-h ab-md-h' + h[1].length + '">' + applyAboutInline(escapeAboutHtml(h[2])) + '</div>'); continue; }
            var bq = /^>\\s?(.*)$/.exec(trimmed);
            if (bq) { flushList(); out.push('<div class="ab-md-bq">' + applyAboutInline(escapeAboutHtml(bq[1])) + '</div>'); continue; }
            var ul = /^\\s*[\\-\\*]\\s+(.*)$/.exec(trimmed);
            if (ul) {
                if (!inList) { out.push('<ul class="ab-md-ul">'); inList = true; }
                out.push('<li>' + applyAboutInline(escapeAboutHtml(ul[1])) + '</li>');
                continue;
            }
            flushList();
            out.push('<div class="ab-md-p">' + applyAboutInline(escapeAboutHtml(trimmed)) + '</div>');
        }
        flushList();
        return out.join('');
    }

    function escapeAboutHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function applyAboutInline(s) {
        /* Inline code first: must run before bold/italic so a backtick block
           containing * or _ characters isn't shredded into <strong>/<em>.
           \\x60 = backtick literal (this whole script is inside a TS template literal). */
        var btRe = new RegExp('\\x60([^\\x60]+)\\x60', 'g');
        s = s.replace(btRe, '<code class="ab-md-code">$1</code>');
        s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        s = s.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
        /* Single-underscore italic must not fire inside identifiers (foo_bar_baz);
           the surrounding lookarounds reject when adjacent to word chars. */
        s = s.replace(/(?<![\\w])_([^_\\n]+)_(?![\\w])/g, '<em>$1</em>');
        /* Links: keep the visible text, drop the URL — the Marketplace link above
           the changelog is the single authorized external nav from this panel. */
        s = s.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '<span class="ab-md-link">$1</span>');
        return s;
    }

    /* ---- Long-press on the title to copy "Saropa Log Capture vX.Y.Z" ----
       500 ms threshold matches the platform mobile long-press convention and is
       long enough to avoid stealing accidental clicks from selection drags inside
       the panel. Mouse and touch are both wired so the gesture works in VS Code
       Desktop and in vscode.dev / Web. */
    var titleRow = document.getElementById('ab-title-row');
    var pressTimer = 0;
    var pressArmed = false;
    function cancelTitlePress() {
        clearTimeout(pressTimer);
        pressArmed = false;
        if (titleRow) titleRow.classList.remove('ab-title-pressing');
    }
    function startTitlePress() {
        if (!titleRow) return;
        cancelTitlePress();
        pressArmed = true;
        titleRow.classList.add('ab-title-pressing');
        pressTimer = setTimeout(function() {
            if (!pressArmed) return;
            pressArmed = false;
            if (titleRow) titleRow.classList.remove('ab-title-pressing');
            copyTitleText();
        }, 500);
    }
    function copyTitleText() {
        var label = aboutPanelEl ? aboutPanelEl.querySelector('.ab-version-label') : null;
        var badgeEl = document.getElementById('ab-version-badge');
        if (!label) return;
        var labelText = (label.textContent || '').trim();
        var badgeText = badgeEl ? (badgeEl.textContent || '').trim() : '';
        var text = badgeText ? labelText + ' ' + badgeText : labelText;
        if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        /* Reuse the viewer's shared toast (defined in viewer-copy.ts at global
           scope, loaded earlier in the script list) so styling stays consistent. */
        if (typeof showCopyToast === 'function') showCopyToast('Copied: ' + text);
    }
    if (titleRow) {
        titleRow.addEventListener('mousedown', startTitlePress);
        titleRow.addEventListener('mouseup', cancelTitlePress);
        titleRow.addEventListener('mouseleave', cancelTitlePress);
        titleRow.addEventListener('touchstart', startTitlePress, { passive: true });
        titleRow.addEventListener('touchend', cancelTitlePress);
        titleRow.addEventListener('touchcancel', cancelTitlePress);
        /* Suppress the synthetic click that would otherwise fire after a long
           press; nothing else listens for click on the title row today but this
           guards against future click handlers stealing the copied state. */
        titleRow.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    }

    /* ---- Click handlers ---- */

    if (aboutPanelEl) {
        aboutPanelEl.addEventListener('click', function(e) {
            var link = e.target.closest('.ab-link');
            var changelogLink = e.target.closest('#about-changelog-link');
            if (changelogLink) {
                e.preventDefault();
                var url = changelogLink.getAttribute('data-url');
                if (url && url !== '#' && typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'openUrl', url: url });
                return;
            }
            if (!link) return;
            var url = link.getAttribute('data-url');
            if (url) vscodeApi.postMessage({ type: 'openUrl', url: url });
        });
    }

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('about-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAboutPanel);

    document.addEventListener('click', function(e) {
        if (!aboutPanelOpen) return;
        if (aboutPanelEl && aboutPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-about');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeAboutPanel();
    });
})();
`;
}

interface AboutLink { icon: string; title: string; badge: string; desc: string; url: string }

function linkHtml(l: AboutLink): string {
    return `<div class="ab-link" data-url="${l.url}">
    <span class="ab-link-icon">${l.icon}</span>
    <span>
        <span class="ab-link-title">${l.title}</span>
        <span class="ab-link-badge">${l.badge}</span>
        <span class="ab-link-desc">${l.desc}</span>
    </span>
</div>`;
}

function getProjectLinksHtml(): string {
    return [
        linkHtml({
            icon: '\u{1F4F1}', title: 'Saropa Contacts',
            badge: 'iOS, Android, Web \u00b7 50K+ downloads \u00b7 \u2605 4.8',
            desc: 'The superpower your address book is missing. An Intelligent Address Book with Business Card Mode, 252+ medical tips, global emergency numbers for 195+ countries, and biometric locking.',
            url: 'https://saropa.com/'
        }),
        linkHtml({
            icon: '\u{1F4CB}', title: 'Saropa Log Capture',
            badge: 'VS Code Marketplace',
            desc: 'The Debugger\u2019s Safety Net. Automatically saves all Debug Console output to persistent log files. No setup required\u2009\u2014\u2009just hit F5 and your logs are safe.',
            url: buildItemUrl('saropa.saropa-log-capture')
        }),
        linkHtml({
            icon: '\u{1F50D}', title: 'saropa_lints', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: '1700+ custom rules. Catch memory leaks, security vulnerabilities (mapped to OWASP Top 10), and runtime crashes. Includes AI-ready diagnostics for faster repairs.',
            url: 'https://pub.dev/packages/saropa_lints'
        }),
        linkHtml({
            icon: '\u{1F9F0}', title: 'saropa_dart_utils', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: 'The Swiss Army library. 280+ production-hardened extension methods for Strings, Dates, and Lists extracted from real-world apps.',
            url: 'https://pub.dev/packages/saropa_dart_utils'
        }),
    ].join('\n');
}

function getConnectLinksHtml(): string {
    return [
        linkHtml({
            icon: '\u{1F4BB}', title: 'GitHub', badge: 'github.com/saropa',
            desc: 'Source, issues, discussions',
            url: 'https://github.com/saropa/saropa-log-capture'
        }),
        linkHtml({
            icon: '\u{1F4DD}', title: 'Medium', badge: '@saropa-contacts',
            desc: 'Exploring the architecture of connection\u2009\u2014\u2009psychology of relationships, social values, and resilient tech practices.',
            url: 'https://medium.com/@saropa-contacts'
        }),
        linkHtml({
            icon: '\u{1F98B}', title: 'Bluesky', badge: 'saropa.com',
            desc: 'News feed',
            url: 'https://bsky.app/profile/saropa.com'
        }),
        linkHtml({
            icon: '\u{1F4BC}', title: 'LinkedIn', badge: 'Saropa Pty Ltd \u00b7 est. 2010',
            desc: 'Financial services, online security, and secure web communications.',
            url: 'https://www.linkedin.com/company/saropa-pty-ltd'
        }),
    ].join('\n');
}
