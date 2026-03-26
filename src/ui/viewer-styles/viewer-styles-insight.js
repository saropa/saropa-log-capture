"use strict";
/**
 * CSS styles for the Insight panel — single-scroll unified view (Unified Insight Model).
 * Accordion sections; no tabs. Reuses session-investigation and recurring card classes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsightPanelStyles = getInsightPanelStyles;
const viewer_styles_insight_layout_1 = require("./viewer-styles-insight-layout");
const viewer_styles_insight_sections_1 = require("./viewer-styles-insight-sections");
const viewer_styles_insight_hero_1 = require("./viewer-styles-insight-hero");
/** Return CSS for the Insight panel and accordion sections. */
function getInsightPanelStyles() {
    return (0, viewer_styles_insight_layout_1.getInsightLayoutStyles)() + (0, viewer_styles_insight_sections_1.getInsightSectionsStyles)() + (0, viewer_styles_insight_hero_1.getInsightHeroStyles)();
}
//# sourceMappingURL=viewer-styles-insight.js.map