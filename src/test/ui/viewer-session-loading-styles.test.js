"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests for session panel loading/shimmer CSS classes.
 * Verifies the shimmer-meta class exists and reuses the shared animation.
 */
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const viewer_styles_session_tags_loading_1 = require("../../ui/viewer-styles/viewer-styles-session-tags-loading");
(0, node_test_1.default)("session-shimmer-meta class should exist with animation", () => {
    const css = (0, viewer_styles_session_tags_loading_1.getSessionTagsLoadingStyles)();
    strict_1.default.match(css, /\.session-shimmer-meta\s*\{/, "shimmer-meta class must be defined");
    strict_1.default.match(css, /\.session-shimmer-meta::after\s*\{.*?animation:\s*session-shimmer/s, "shimmer-meta ::after must use the shared session-shimmer animation");
});
(0, node_test_1.default)("session-shimmer-meta should have position:relative and overflow:hidden", () => {
    const css = (0, viewer_styles_session_tags_loading_1.getSessionTagsLoadingStyles)();
    strict_1.default.match(css, /\.session-shimmer-meta\s*\{[^}]*position:\s*relative/s, "shimmer-meta needs position:relative for the ::after overlay");
    strict_1.default.match(css, /\.session-shimmer-meta\s*\{[^}]*overflow:\s*hidden/s, "shimmer-meta needs overflow:hidden to clip the sweep");
});
(0, node_test_1.default)("session-shimmer keyframe animation should be defined", () => {
    const css = (0, viewer_styles_session_tags_loading_1.getSessionTagsLoadingStyles)();
    strict_1.default.match(css, /@keyframes session-shimmer\s*\{/, "session-shimmer keyframe must exist for the sweep animation");
});
//# sourceMappingURL=viewer-session-loading-styles.test.js.map