/**
 * About Saropa panel HTML and script for the webview.
 *
 * Displays company info, project links, and social links
 * in a slide-out panel following the icon-bar panel pattern.
 */

import { buildItemUrl } from "../../modules/marketplace-url";
import { t } from "../../l10n";

/** Generate the about panel HTML with static content.
 *  Chrome and marketing prose (tagline, blurb, link descriptions) are localized
 *  via t(); product NAMES, badges, URLs, and the Debug section stay English —
 *  proper nouns in the prose are protected by the translate pipeline's brand
 *  shielding. See the strings-viewer-c.ts note. */
export function getAboutPanelHtml(): string {
    return /* html */ `
<div id="about-panel" class="about-panel" role="region" aria-label="${t('viewer.about.region')}">
    <div class="about-panel-header">
        <span>${t('viewer.about.region')}</span>
        <button id="about-panel-close" class="about-panel-close" title="${t('viewer.about.close.title')}" aria-label="${t('viewer.about.close.label')}"><span class="codicon codicon-close"></span></button>
    </div>
    <div class="about-panel-content">
        <div id="ab-title-row" class="ab-version-row" title="${t('viewer.about.copyHint')}">
            <span class="ab-version-label">Saropa Log Capture</span>
            <span id="ab-version-badge" class="ab-version-badge"></span>
        </div>
        <p class="ab-tagline">${t('viewer.about.tagline')}</p>
        <p class="ab-blurb">${t('viewer.about.blurb')}</p>
        ${sectionHeaderHtml('changes', t('viewer.about.recentChanges'))}
        <div class="ab-section-body" data-section-body="changes">
            <a id="about-changelog-link" href="#" class="ab-changelog-link" data-uri="">${t('viewer.about.openChangelog')}</a>
        </div>
        ${sectionHeaderHtml('projects', t('viewer.about.projects'))}
        <div class="ab-section-body" data-section-body="projects">${getProjectLinksHtml()}</div>
        ${sectionHeaderHtml('connect', t('viewer.about.connect'))}
        <div class="ab-section-body" data-section-body="connect">${getConnectLinksHtml()}</div>
        ${sectionHeaderHtml('debug', t('viewer.about.debug'))}
        <div class="ab-section-body" data-section-body="debug">
            <div id="about-debug-list" class="ab-debug-list"><span class="ab-debug-loading">${t('viewer.about.debugLoading')}</span></div>
        </div>
    </div>
</div>`;
}

/** A collapsible section header: a clickable row with a chevron that toggles the matching
 *  `data-section-body`. Every section is collapsible (user request); all start expanded. */
function sectionHeaderHtml(id: string, label: string): string {
    return `<div class="ab-section ab-section-toggle" data-section="${id}" role="button" tabindex="0" aria-expanded="true">`
        + `<span class="ab-section-chevron codicon codicon-chevron-down"></span>${label}</div>`;
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
        if (typeof clearActivePanel === 'function') clearActivePanel('about');
        var ibBtn = document.getElementById('ib-about');
        if (ibBtn) ibBtn.focus();
    };

    /* Toggle a collapsible section: flip the header's collapsed class + chevron and hide/show
       the matching body. Keyed by data-section / data-section-body so headers and bodies are
       siblings (no wrapper needed), which keeps the existing flat content flow. */
    function toggleAboutSection(header) {
        var id = header.getAttribute('data-section');
        if (!id || !aboutPanelEl) return;
        var collapsed = header.classList.toggle('ab-section-collapsed');
        var body = aboutPanelEl.querySelector('[data-section-body="' + id + '"]');
        if (body) body.classList.toggle('ab-section-body-hidden', collapsed);
        var chev = header.querySelector('.ab-section-chevron');
        if (chev) {
            chev.classList.toggle('codicon-chevron-right', collapsed);
            chev.classList.toggle('codicon-chevron-down', !collapsed);
        }
        header.setAttribute('aria-expanded', String(!collapsed));
    }

    function escAboutHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function escAboutAttr(s) { return escAboutHtml(s).replace(/"/g, '&quot;'); }

    /* Render the Debug section: one row per meta file/folder the extension uses, showing its
       live present/missing state and usage. Files open in the log viewer on click; the reports
       folder reveals in the OS explorer. The whole point is to make the on-disk state visible
       (e.g. whether .loaded-files-history.json was actually written) instead of guessing. */
    function renderAboutDebugList(metaPaths) {
        var listEl = document.getElementById('about-debug-list');
        if (!listEl) return;
        if (!metaPaths || !metaPaths.length) { listEl.textContent = vt('viewer.about.debugNoPaths'); return; }
        var html = '';
        for (var i = 0; i < metaPaths.length; i++) {
            var m = metaPaths[i];
            var stateCls = m.exists ? 'ab-debug-present' : 'ab-debug-missing';
            var stateTxt = m.exists ? vt('viewer.about.debugPresent') : vt('viewer.about.debugMissing');
            var title = m.kind === 'folder' ? vt('viewer.about.revealInOS') : vt('viewer.about.openInViewer');
            var icon = m.kind === 'folder' ? 'codicon-folder' : 'codicon-file';
            html += '<div class="ab-debug-row" data-uri="' + escAboutAttr(m.uriString) + '" data-kind="' + m.kind + '"'
                + ' role="button" tabindex="0" title="' + escAboutAttr(title) + '">'
                + '<span class="ab-debug-label"><span class="codicon ' + icon + '"></span> ' + escAboutHtml(m.label)
                + ' <span class="ab-debug-state ' + stateCls + '">' + stateTxt + '</span></span>'
                + '<span class="ab-debug-usage">' + escAboutHtml(m.usage) + '</span>'
                + '<span class="ab-debug-path">' + escAboutHtml(m.fsPath) + '</span>'
                + '</div>';
        }
        listEl.innerHTML = html;
    }

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
        /* Changelog now opens in the log viewer (markdown-rendered) rather than being dumped
           inline — stash its URI on the link; the click handler posts openSessionFromPanel. */
        var link = document.getElementById('about-changelog-link');
        if (link) link.setAttribute('data-uri', e.data.changelogUriString || '');
        renderAboutDebugList(e.data.metaPaths);
    });

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
        if (typeof showCopyToast === 'function') showCopyToast(vt('viewer.about.copied', text));
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
            /* Collapsible section header toggle takes precedence over any link inside it. */
            var sectionHeader = e.target.closest('.ab-section-toggle');
            if (sectionHeader) { toggleAboutSection(sectionHeader); return; }
            /* Changelog: open CHANGELOG.md in the log viewer (markdown view) to the side. */
            var changelogLink = e.target.closest('#about-changelog-link');
            if (changelogLink) {
                e.preventDefault();
                var cu = changelogLink.getAttribute('data-uri');
                if (cu && typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: cu });
                return;
            }
            /* Debug rows: files open in the viewer, the reports folder reveals in the OS. */
            var debugRow = e.target.closest('.ab-debug-row');
            if (debugRow && typeof vscodeApi !== 'undefined') {
                var du = debugRow.getAttribute('data-uri');
                if (du) {
                    var kind = debugRow.getAttribute('data-kind');
                    vscodeApi.postMessage(kind === 'folder'
                        ? { type: 'revealPathInOS', uriString: du }
                        : { type: 'openSessionFromPanel', uriString: du });
                }
                return;
            }
            var link = e.target.closest('.ab-link');
            if (!link) return;
            var url = link.getAttribute('data-url');
            if (url) vscodeApi.postMessage({ type: 'openUrl', url: url });
        });
        /* Keyboard parity for section headers and debug rows (both are role="button"). */
        aboutPanelEl.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var sh = e.target.closest('.ab-section-toggle');
            if (sh) { e.preventDefault(); toggleAboutSection(sh); return; }
            var dr = e.target.closest('.ab-debug-row');
            if (dr) { e.preventDefault(); dr.click(); }
        });
    }

    /* ---- Close ---- only via the X button. Clicking outside no longer closes the panel
       (user request): the About screen stays open until explicitly dismissed, so you can
       click into the viewer to inspect a debug file without it vanishing. */

    var closeBtn = document.getElementById('about-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAboutPanel);
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
            desc: t('viewer.about.project.contacts.desc'),
            url: 'https://saropa.com/'
        }),
        linkHtml({
            icon: '\u{1F4CB}', title: 'Saropa Log Capture',
            badge: 'VS Code Marketplace',
            desc: t('viewer.about.project.logCapture.desc'),
            url: buildItemUrl('saropa.saropa-log-capture')
        }),
        linkHtml({
            icon: '\u{1F50D}', title: 'saropa_lints', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: t('viewer.about.project.lints.desc'),
            url: 'https://pub.dev/packages/saropa_lints'
        }),
        linkHtml({
            icon: '\u{1F9F0}', title: 'saropa_dart_utils', badge: 'pub.dev \u00b7 Dart & Flutter',
            desc: t('viewer.about.project.dartUtils.desc'),
            url: 'https://pub.dev/packages/saropa_dart_utils'
        }),
    ].join('\n');
}

function getConnectLinksHtml(): string {
    return [
        linkHtml({
            icon: '\u{1F4BB}', title: 'GitHub', badge: 'github.com/saropa',
            desc: t('viewer.about.connect.github.desc'),
            url: 'https://github.com/saropa/saropa-log-capture'
        }),
        linkHtml({
            icon: '\u{1F4DD}', title: 'Medium', badge: '@saropa-contacts',
            desc: t('viewer.about.connect.medium.desc'),
            url: 'https://medium.com/@saropa-contacts'
        }),
        linkHtml({
            icon: '\u{1F98B}', title: 'Bluesky', badge: 'saropa.com',
            desc: t('viewer.about.connect.bluesky.desc'),
            url: 'https://bsky.app/profile/saropa.com'
        }),
        linkHtml({
            icon: '\u{1F4BC}', title: 'LinkedIn', badge: 'Saropa Pty Ltd \u00b7 est. 2010',
            desc: t('viewer.about.connect.linkedin.desc'),
            url: 'https://www.linkedin.com/company/saropa-pty-ltd'
        }),
    ].join('\n');
}
