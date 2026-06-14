/**
 * Render half of the session-info modal: header-line parsing, section grouping,
 * hotlink resolution, and HTML construction. Lives in its own file so the
 * shell (modal HTML + open/close + long-press wiring) in
 * viewer-session-info-modal.ts can stay under the line limit.
 */

import { escapeHtmlScript } from '../escape-html-script';

/** Returns the webview JS that defines parseHeaderRecords / groupRecords /
 *  renderSessionInfo. The shell script in viewer-session-info-modal calls
 *  renderSessionInfo(rootEl, headerLines) at open time. */
export function getSessionInfoRenderScript(): string {
    return /* javascript */ `
(function defineSessionInfoRender() {
    /* ---------- Header-line parser ----------
       Returns [{ key, value, indent }] excluding the two === divider lines and
       the opening '=== SAROPA LOG CAPTURE ...' banner (that line drives the
       modal title, not a body row). */
    function parseHeaderRecords(lines) {
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];
            if (typeof raw !== 'string') continue;
            if (raw.indexOf('=== SAROPA LOG CAPTURE') === 0) continue;
            if (/^={10,}$/.test(raw.trim())) continue;
            var indent = 0, j = 0;
            while (j < raw.length && raw.charAt(j) === ' ') { j++; indent++; }
            var rest = raw.substring(j);
            var colonIdx = rest.indexOf(':');
            if (colonIdx === -1) {
                out.push({ key: '', value: rest.trim(), indent: indent });
                continue;
            }
            out.push({
                key: rest.substring(0, colonIdx).trim(),
                value: rest.substring(colonIdx + 1).trim(),
                indent: indent,
            });
        }
        return out;
    }

    /* ---------- Grouping ----------
       Fixed sections keep the visual order users expect (session → launch →
       env → git → system → integrations) instead of the file order, which
       intermixes git into the middle of the OS block. Unknown top-level keys
       fall through to 'integrations' so adapter extras (Drift Advisor URL,
       Slow query threshold, etc.) still surface. */
    var SECTIONS = [
        { id: 'session', titleKey: 'viewer.sessionInfo.section.session', keys: ['Extension version', 'Date', 'Project', 'Debug Adapter'] },
        { id: 'launch', titleKey: 'viewer.sessionInfo.section.launch', keys: ['launch.json'] },
        { id: 'environment', titleKey: 'viewer.sessionInfo.section.environment', keys: ['VS Code', 'Extension', 'OS', 'Node', 'Remote'] },
        { id: 'git', titleKey: 'viewer.sessionInfo.section.git', keys: ['Git Branch', 'Git Commit', 'Git Remote', 'Git describe', 'Uncommitted'] },
        { id: 'system', titleKey: 'viewer.sessionInfo.section.system', keys: ['System'] },
        { id: 'integrations', titleKey: 'viewer.sessionInfo.section.integrations', keys: [] },
    ];

    function groupRecords(records) {
        var out = {};
        SECTIONS.forEach(function(s) { out[s.id] = []; });
        var keyToSection = {};
        SECTIONS.forEach(function(s) { s.keys.forEach(function(k) { keyToSection[k] = s.id; }); });
        for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            if (!rec.key && !rec.value) continue;
            if (rec.indent > 0) { out.launch.push(rec); continue; }
            var sid = keyToSection[rec.key];
            if (sid) out[sid].push(rec); else out.integrations.push(rec);
        }
        return out;
    }

    /* ---------- Hotlink helpers ---------- */
    function unquote(s) {
        if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
            try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
        }
        return s;
    }
    function isHttpUrl(s) { return /^https?:\\/\\//.test(s); }
    /* Path-shaped values surfaced as one-click reveals in the OS file explorer.
       Sourced from the launch.json sub-keys. */
    var PATH_KEYS = { program: 1, cwd: 1, projectRootPath: 1, flutterSdkPath: 1, dartSdkPath: 1 };
    function isPathKey(key) { return Object.prototype.hasOwnProperty.call(PATH_KEYS, key); }

    ${escapeHtmlScript('escapeHtml')}

    function renderValueWithLinks(rec) {
        var raw = rec.value;
        var key = rec.key;
        if (isHttpUrl(raw)) {
            return '<a class="session-info-link" data-action="open-url" data-url="' + escapeHtml(encodeURI(raw)) + '" href="#" title="' + escapeHtml(vt('viewer.sessionInfo.openInBrowser')) + '">' + escapeHtml(raw) + '</a>';
        }
        var unq = unquote(raw);
        if (isHttpUrl(unq)) {
            return '<a class="session-info-link" data-action="open-url" data-url="' + escapeHtml(encodeURI(unq)) + '" href="#" title="' + escapeHtml(vt('viewer.sessionInfo.openInBrowser')) + '">' + escapeHtml(unq) + '</a>';
        }
        if (isPathKey(key)) {
            return '<a class="session-info-link session-info-path" data-action="reveal-path" data-path="' + escapeHtml(unq) + '" href="#" title="' + escapeHtml(vt('viewer.sessionInfo.revealInExplorer')) + '">' + escapeHtml(unq) + '</a>';
        }
        return escapeHtml(raw);
    }

    /* Uncommitted is "N file(s) — a, b, c, (+M more)" — wrap the tail in a
       details/summary so the full list doesn't hijack the modal height. */
    function renderUncommittedRow(rec) {
        var v = rec.value || '';
        var idx = v.indexOf(' — ');
        if (idx === -1 || !/\\(\\+\\d+ more\\)$/.test(v)) return basicRow(rec);
        var head = v.substring(0, idx);
        var files = v.substring(idx + 3);
        return '<div class="session-info-row" data-copyable="1" data-copytext="' + escapeHtml(rec.key + ': ' + v) + '">'
            + '<span class="session-info-key">' + escapeHtml(rec.key) + '</span>'
            + '<details class="session-info-details">'
            +   '<summary class="session-info-value">' + escapeHtml(head) + '</summary>'
            +   '<div class="session-info-details-body">' + escapeHtml(files) + '</div>'
            + '</details>'
            + '</div>';
    }

    function basicRow(rec) {
        var copy = (rec.key ? rec.key + ': ' : '') + rec.value;
        var keyHtml = rec.key ? '<span class="session-info-key">' + escapeHtml(rec.key) + '</span>' : '';
        var valueHtml = '<span class="session-info-value">' + renderValueWithLinks(rec) + '</span>';
        return '<div class="session-info-row" data-copyable="1" data-copytext="' + escapeHtml(copy) + '">' + keyHtml + valueHtml + '</div>';
    }

    function renderSection(sectionDef, records) {
        if (!records || records.length === 0) return '';
        var title = vt(sectionDef.titleKey);
        var inner = '';
        for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            if (rec.key === 'Uncommitted') { inner += renderUncommittedRow(rec); continue; }
            inner += basicRow(rec);
        }
        return '<details class="session-info-section" open>'
            + '<summary class="session-info-section-title">' + escapeHtml(title) + '</summary>'
            + '<div class="session-info-section-body">' + inner + '</div>'
            + '</details>';
    }

    window.__renderSessionInfo = function(rootEl, headerLines) {
        if (!rootEl) return;
        var records = parseHeaderRecords(headerLines || []);
        if (records.length === 0) {
            rootEl.innerHTML = '<div class="session-info-empty">' + escapeHtml(vt('viewer.sessionInfo.empty')) + '</div>';
            return;
        }
        var groups = groupRecords(records);
        var html = '';
        for (var i = 0; i < SECTIONS.length; i++) {
            html += renderSection(SECTIONS[i], groups[SECTIONS[i].id]);
        }
        rootEl.innerHTML = html;
    };
})();
`;
}
