/**
 * Single source of truth for the VS Code extension ID (`publisher.name` from package.json).
 *
 * Must stay equal to the marketplace listing's ID: the Marketplace and Open VSX treat a different
 * `name` as a brand-new extension, so installed copies would never receive updates. Do not change it
 * to match the product display name ("Saropa Capture") — that is a separate, user-visible string.
 */
export const extensionId = 'saropa.saropa-log-capture';
