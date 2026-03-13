/**
 * Centralized marketplace base URL for extension links (changelog, item page).
 * Fork maintainers can replace this at build time or extend with config later.
 */
const MARKETPLACE_BASE = "https://marketplace.visualstudio.com/items";

/** Base URL for VS Code Marketplace (or override for Open VS X etc.). */
export function getMarketplaceBaseUrl(): string {
  return MARKETPLACE_BASE;
}

/** Build changelog URL: {base}/{extensionId}/changelog */
export function buildChangelogUrl(extensionId: string): string {
  return `${getMarketplaceBaseUrl()}/${extensionId}/changelog`;
}

/** Build item page URL: {base}?itemName={extensionId} */
export function buildItemUrl(extensionId: string): string {
  return `${getMarketplaceBaseUrl()}?itemName=${encodeURIComponent(extensionId)}`;
}
