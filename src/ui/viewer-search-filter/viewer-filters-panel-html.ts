/**
 * HTML template for the Tags & Origins slide-out panel.
 *
 * Opened from the icon bar Tags button. Contains chip-heavy browsing
 * sections that need room to breathe — moved out of the narrow filter
 * drawer where they were crammed into tiny accordions.
 *
 * Sections:
 *   - Message Tags (source tag chips from logging framework)
 *   - Code Origins (class/method tag chips)
 *   - SQL Commands (normalized Drift SQL fingerprints)
 *   - Individual Sources (per-category toggles — hidden placeholder)
 *
 * Tag search input at the top filters chip labels across all sections.
 */

/** Returns the HTML for the Tags & Origins panel element. */
export function getTagsPanelHtml(): string {
    return `<div id="tags-panel" class="options-panel" role="region" aria-label="Tags and Origins">
    <div class="options-header">
        <span>Tags &amp; Origins</span>
        <button class="tags-close options-close" title="Close" aria-label="Close Tags &amp; Origins">&times;</button>
    </div>

    <div class="options-search-wrapper">
        <input id="tags-search" type="text" placeholder="Search tags\u2026" aria-label="Search tags" />
        <button id="tags-search-clear" class="options-search-clear" title="Clear" aria-label="Clear search">&times;</button>
    </div>

    <div class="options-content">
        <!-- Message Tags Section (populated dynamically by rebuildTagChips) -->
        <div class="options-section" id="log-tags-section" style="display:none">
            <h3 class="options-section-title">Message Tags</h3>
            <div class="options-hint">Tags from your logging framework</div>
            <div class="options-row">
                <span id="source-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- Code Origins Section (populated dynamically by rebuildClassTagChips) -->
        <div class="options-section" id="class-tags-section" style="display:none">
            <h3 class="options-section-title">Code Origins</h3>
            <div class="options-hint">Class &amp; method where log originated</div>
            <div class="options-row">
                <span id="class-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- SQL command-type chips (verb-based: SELECT, INSERT, etc.) -->
        <div class="options-section" id="sql-patterns-section" style="display:none">
            <h3 class="options-section-title">SQL Commands</h3>
            <div class="options-row">
                <span id="sql-pattern-summary" class="source-tag-summary"></span>
            </div>
            <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
            <div class="options-row">
                <button type="button" id="open-sql-query-history-from-tags" class="options-action-btn" title="Open scrollable list of SQL fingerprints for this session">SQL Query History\u2026</button>
            </div>
        </div>

        <!-- Individual Sources: per-category toggles (placeholder, hidden until populated) -->
        <div class="options-section" id="individual-sources-section" style="display:none">
            <h3 class="options-section-title">Individual Sources</h3>
            <div class="options-hint">Toggle visibility of individual output channels</div>
            <div class="options-row">
                <span id="source-category-summary" class="source-tag-summary"></span>
            </div>
            <div id="source-category-chips" class="source-tag-chips options-tags"></div>
        </div>
    </div>
</div>`;
}
