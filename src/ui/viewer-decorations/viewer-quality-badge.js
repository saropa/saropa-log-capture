"use strict";
/**
 * Quality coverage badge for stack frame lines.
 * Shows a coloured badge (green/yellow/red) with the line coverage
 * percentage when the `decoShowQuality` sub-toggle is enabled.
 *
 * Concatenated into the same script scope as viewer-decorations.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQualityBadgeScript = getQualityBadgeScript;
/** Returns the JavaScript code for quality badge rendering. */
function getQualityBadgeScript() {
    return /* javascript */ `
/** Sub-toggle: show coverage quality badge on stack frame lines. */
var decoShowQuality = true;

/**
 * Return a quality badge HTML string for the given line item.
 * Only rendered when the quality toggle is on
 * and the item carries a qualityPercent value.
 */
function getQualityBadge(item) {
    if (!decoShowQuality) return '';
    var pct = item.qualityPercent;
    if (pct === undefined || pct === null) return '';
    var cls = pct >= 80 ? 'high' : (pct >= 50 ? 'med' : 'low');
    return '<span class="quality-badge qb-' + cls + '" title="' + pct + '% line coverage">' + pct + '%</span> ';
}
`;
}
//# sourceMappingURL=viewer-quality-badge.js.map