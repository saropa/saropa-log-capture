"use strict";
/**
 * Types for the optional Saropa Lints extension API.
 *
 * When the Saropa Lints extension is installed and exposes this API, Log Capture
 * uses it to read violations and health score params without re-reading the file.
 * Fallback: read reports/.saropa_lints/violations.json from disk and use built-in constants.
 *
 * Extension id: saropa.saropa-lints
 * Consumer: getExtension('saropa.saropa-lints') then ext.exports (or await ext.activate()).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAROPA_LINTS_EXTENSION_ID = void 0;
/** Extension id for Saropa Lints. Use with vscode.extensions.getExtension(id). */
exports.SAROPA_LINTS_EXTENSION_ID = 'saropa.saropa-lints';
//# sourceMappingURL=saropa-lints-api.js.map