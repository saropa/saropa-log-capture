"use strict";
/**
 * Investigation mode data model types.
 * An investigation is a named collection of pinned sources (sessions and files)
 * that can be searched together and exported as a bundle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKIP_SIDECAR_EXTENSIONS = exports.SEARCHABLE_SIDECAR_EXTENSIONS = exports.MAX_SEARCH_HISTORY = exports.MAX_RESULTS_PER_SOURCE = exports.MAX_SEARCH_FILE_SIZE = exports.MAX_SOURCES_PER_INVESTIGATION = exports.MAX_INVESTIGATIONS = void 0;
/** Maximum number of investigations per workspace. */
exports.MAX_INVESTIGATIONS = 50;
/** Maximum number of sources per investigation. */
exports.MAX_SOURCES_PER_INVESTIGATION = 20;
/** Maximum file size to search fully (bytes). Files larger than this show a warning. */
exports.MAX_SEARCH_FILE_SIZE = 10 * 1024 * 1024; // 10MB
/** Maximum search results per source file. */
exports.MAX_RESULTS_PER_SOURCE = 100;
/** Maximum search history entries. */
exports.MAX_SEARCH_HISTORY = 10;
/** Known sidecar extensions that can be searched. */
exports.SEARCHABLE_SIDECAR_EXTENSIONS = [
    '.terminal.log',
    '.unified.jsonl',
    '.requests.json',
    '.events.json',
    '.queries.json',
    '.browser.json',
    '.container.log',
    '.linux.log',
];
/** Sidecar extensions to skip (numeric/binary data only). */
exports.SKIP_SIDECAR_EXTENSIONS = [
    '.perf.json',
    '.crash-dumps.json',
    '.security.json',
    '.audit.json',
];
//# sourceMappingURL=investigation-types.js.map