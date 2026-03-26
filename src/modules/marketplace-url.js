"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceBaseUrl = getMarketplaceBaseUrl;
exports.buildChangelogUrl = buildChangelogUrl;
exports.buildItemUrl = buildItemUrl;
/**
 * Centralized marketplace base URL for extension links (changelog, item page).
 * Fork maintainers can replace this at build time or extend with config later.
 */
const MARKETPLACE_BASE = "https://marketplace.visualstudio.com/items";
/** Base URL for VS Code Marketplace (or override for Open VS X etc.). */
function getMarketplaceBaseUrl() {
    return MARKETPLACE_BASE;
}
/** Build changelog URL: {base}/{extensionId}/changelog */
function buildChangelogUrl(extensionId) {
    return `${getMarketplaceBaseUrl()}/${extensionId}/changelog`;
}
/** Build item page URL: {base}?itemName={extensionId} */
function buildItemUrl(extensionId) {
    return `${getMarketplaceBaseUrl()}?itemName=${encodeURIComponent(extensionId)}`;
}
//# sourceMappingURL=marketplace-url.js.map