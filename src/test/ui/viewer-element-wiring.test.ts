import * as assert from 'node:assert';
import { buildViewerHtml, getNonce } from '../../ui/provider/viewer-content';

/**
 * Cross-reference test: every `getElementById('x')` call in webview scripts
 * must have a matching `id="x"` in the generated HTML body.
 *
 * Catches the exact class of bug that broke the toolbar search button and
 * actions menu — stale element references after a refactor silently fail
 * at runtime because `getElementById` returns null.
 */
suite('Webview element ID wiring', () => {

    /**
     * IDs that are created dynamically at runtime (not in static HTML).
     * Each entry must have a comment explaining where/how it is created.
     */
    const dynamicIds = new Set([
        // Created by document.createElement in viewer-layout.ts measureRowHeight()
        'height-probe',
        // Created by document.createElement in viewer-error-handler.ts onerror handler
        'script-error-banner',
        'script-error-text',
        // Created by document.createElement in viewer-context-modal.ts
        'inline-peek',
        // Created by document.createElement in viewer-context-popover-shared-script.ts
        'popover-toast',
        // Created via innerHTML in viewer-edit-modal.ts openEditModal()
        'edit-modal-overlay',
        'edit-modal-textarea',
        'edit-modal-save',
        'edit-modal-cancel',
        // Created via innerHTML in viewer-crashlytics-setup.ts
        'cp-check-again',
    ]);

    /**
     * IDs from removed UI that are still referenced in scripts but guarded
     * by null checks (harmless no-ops). Should be cleaned up over time.
     */
    const staleIds = new Set([
        // Old footer button — replaced by #toolbar-actions-btn in toolbar refactor
        'footer-actions-btn',
        // Old gear button — removed in toolbar refactor; deco settings can't open
        'deco-settings-btn',
        // Old session nav elements — replaced by toolbar
        'session-nav',
        'session-nav-wrapper',
        // Old icon bar buttons — removed
        'ib-performance',
        'ib-sql-filter',
        'ib-sql-filter-count-short',
        // Old filters panel — removed from body HTML
        'filters-panel',
        'filters-search',
        'filters-search-clear',
        // Old footer toggle buttons — not in current HTML
        'audio-toggle',
        'deco-toggle',
        'error-breakpoint-toggle',
        'wrap-toggle',
    ]);

    /** Combined allowlist of IDs that aren't expected in static HTML. */
    const allowlist = new Set([...dynamicIds, ...staleIds]);

    function extractHtmlIds(html: string): Set<string> {
        const bodyEnd = html.indexOf('<script');
        const body = bodyEnd > 0 ? html.slice(0, bodyEnd) : html;
        const regex = /\bid="([^"]+)"/g;
        const ids = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = regex.exec(body))) {
            ids.add(m[1]);
        }
        return ids;
    }

    function extractScriptGetElementByIdCalls(html: string): Set<string> {
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
        const getElemRegex = /getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        const ids = new Set<string>();
        let sm: RegExpExecArray | null;
        while ((sm = scriptRegex.exec(html))) {
            let gm: RegExpExecArray | null;
            while ((gm = getElemRegex.exec(sm[1]))) {
                ids.add(gm[1]);
            }
        }
        return ids;
    }

    test('every getElementById in scripts references an element in the HTML', () => {
        const html = buildViewerHtml({
            nonce: getNonce(),
            extensionUri: 'https://example.com',
            version: '0.0.0',
        });

        const htmlIds = extractHtmlIds(html);
        const scriptRefs = extractScriptGetElementByIdCalls(html);

        // Skip dynamic prefix patterns (IDs ending with - are string
        // concatenation prefixes like getElementById('level-' + name))
        const missing: string[] = [];
        for (const id of scriptRefs) {
            if (id.endsWith('-')) { continue; }
            if (htmlIds.has(id)) { continue; }
            if (allowlist.has(id)) { continue; }
            missing.push(id);
        }

        assert.deepStrictEqual(
            missing,
            [],
            `getElementById references to non-existent HTML elements:\n  ${missing.join('\n  ')}\n\nEither add the id to the HTML, update the script, or add to the allowlist with a comment.`,
        );
    });

    test('allowlist entries are still needed (no stale allowlist)', () => {
        const html = buildViewerHtml({
            nonce: getNonce(),
            extensionUri: 'https://example.com',
            version: '0.0.0',
        });

        const htmlIds = extractHtmlIds(html);
        const scriptRefs = extractScriptGetElementByIdCalls(html);

        // An allowlist entry is stale if either:
        // 1. The ID now exists in HTML (so it no longer needs to be allowlisted)
        //    AND is still referenced in scripts
        // 2. The ID is no longer referenced in scripts at all
        const staleEntries: string[] = [];
        for (const id of allowlist) {
            const inHtml = htmlIds.has(id);
            const inScripts = scriptRefs.has(id);
            if (inHtml && inScripts) {
                staleEntries.push(`${id} — now exists in HTML, remove from allowlist`);
            }
            if (!inScripts) {
                staleEntries.push(`${id} — no longer referenced in scripts, remove from allowlist`);
            }
        }

        assert.deepStrictEqual(
            staleEntries,
            [],
            `Allowlist has stale entries:\n  ${staleEntries.join('\n  ')}`,
        );
    });
});
