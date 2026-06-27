import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { getSearchScript } from '../../ui/viewer-search-filter/viewer-search';

/**
 * Regression tests for search match reveal (viewer-search-reveal.ts).
 *
 * A search match must ALWAYS become visible — even when it sits in a collapsed
 * group or behind an active filter. These checks read the generated webview
 * script string and the flyout HTML so they run under Node/mocha without the
 * VS Code test host.
 */
suite('Viewer search reveal', () => {

    function readSrc(relFromSrc: string): string {
        const fromOut = path.join(__dirname, '../../../src', relFromSrc);
        const fromSrcTree = path.join(__dirname, '../../', relFromSrc);
        const p = fs.existsSync(fromOut) ? fromOut : fromSrcTree;
        return fs.readFileSync(p, 'utf8');
    }

    const script = getSearchScript();

    test('reveal module is concatenated into the search script', () => {
        for (const fn of [
            'function revealMatchForSearch',
            'function expandCollapsesForMatch',
            'function searchFilterHider',
            'function clearSearchReveals',
            'function countHiddenSearchMatches',
        ]) {
            assert.ok(script.includes(fn), `search script should define ${fn}`);
        }
    });

    test('scrollToMatch reveals the match before measuring height', () => {
        const at = script.indexOf('function scrollToMatch');
        assert.ok(at >= 0, 'scrollToMatch should exist');
        const body = script.slice(at, at + 600);
        assert.ok(
            body.includes('revealMatchForSearch(idx)'),
            'scrollToMatch must call revealMatchForSearch so a filtered/collapsed match becomes visible',
        );
    });

    test('filter-hidden match is force-shown via peekOverride and tracked for cleanup', () => {
        assert.ok(
            script.includes('item.peekOverride = true') && script.includes('item.searchPeek = true'),
            'revealMatchForSearch must set peekOverride + searchPeek on the matched line',
        );
        assert.ok(
            script.includes('searchRevealIndices.push(idx)'),
            'revealed indices must be tracked so they can be restored',
        );
    });

    test('clearSearchReveals does not clobber a gap/dedup peek on the same row', () => {
        const at = script.indexOf('function clearSearchReveals');
        const body = script.slice(at, at + 500);
        assert.ok(
            body.includes('item.peekAnchorKey == null'),
            'clearSearchReveals must only drop peekOverride when no real peek group owns the row',
        );
    });

    test('expandCollapsesForMatch handles every collapse kind', () => {
        const at = script.indexOf('function expandCollapsesForMatch');
        const body = script.slice(at, at + 1500);
        assert.ok(body.includes('contCollapsed = false'), 'expands continuation groups');
        assert.ok(body.includes('gh.collapsed = false'), 'expands stack-frame groups');
        assert.ok(body.includes('bannerCollapsed = false'), 'expands Flutter banner groups');
        assert.ok(body.includes('toggleAsciiArtBlock'), 'expands ASCII-art blocks');
    });

    test('every Category-A filter flag in calcItemHeight has a hider entry', () => {
        // Keep the reveal notice in lockstep with the visibility gates: if a new
        // filter flag is added to calcItemHeight, it must also be detectable here.
        for (const flag of [
            'levelFiltered', 'excluded', 'sourceFiltered', 'classFiltered',
            'sqlPatternFiltered', 'scopeFiltered', 'metadataFiltered',
            'timeRangeFiltered', 'filteredOut', 'errorSuppressed', 'userHidden',
            'autoHidden',
        ]) {
            assert.ok(script.includes(flag), `hider table should test ${flag}`);
        }
        assert.ok(script.includes('isTierHidden(it)'), 'hider table should detect tier-hidden lines');
    });

    test('flyout HTML exposes the hidden-by-filter notice elements', () => {
        const html = readSrc('ui/viewer-toolbar/viewer-toolbar-search-html.ts');
        for (const id of ['id="search-hidden-notice"', 'id="search-hidden-label"', 'id="search-hidden-disable"']) {
            assert.ok(html.includes(id), `flyout should contain ${id}`);
        }
        assert.ok(html.includes('class="search-hidden-notice" role="status"'), 'the notice is a status region');
    });

    test('notice styling defines the hidden-notice strip', () => {
        const css = readSrc('ui/viewer-styles/viewer-styles-search.ts');
        assert.ok(css.includes('.search-hidden-notice'), 'should style the notice strip');
        assert.ok(css.includes('.search-hidden-disable'), 'should style the disable action');
    });

    test('all reveal l10n keys are defined as webview strings', () => {
        const src = readSrc('l10n/strings-webview-b.ts');
        for (const key of [
            'viewer.search.matchPosition', 'viewer.search.hiddenSuffix',
            'viewer.search.noMatches', 'viewer.search.hiddenNotice',
            'viewer.search.hiddenNotice.disable', 'viewer.search.filterName.level',
            'viewer.search.filterName.tier',
        ]) {
            assert.ok(src.includes(`'${key}'`), `strings-webview-b should define ${key}`);
        }
    });
});
