"use strict";
/**
 * Lint report reader for the code quality metrics integration.
 * Parses ESLint JSON format (`--format json`) and extracts per-file
 * warning/error counts for files referenced in log stack traces.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEslintJson = parseEslintJson;
exports.readLintReport = readLintReport;
const fs = __importStar(require("fs"));
const quality_types_1 = require("./quality-types");
const MAX_LINT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TOP_MESSAGES = 3;
/**
 * Parse ESLint JSON content and extract per-file lint data.
 * Only includes files present in the referenced set (normalized paths).
 */
function parseEslintJson(content, referencedNorm) {
    const result = new Map();
    let entries;
    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return result;
        }
        entries = parsed;
    }
    catch {
        return result;
    }
    for (const raw of entries) {
        const entry = raw;
        if (!entry.filePath || !Array.isArray(entry.messages)) {
            continue;
        }
        const norm = (0, quality_types_1.normalizeForLookup)(entry.filePath);
        if (!referencedNorm.has(norm) && !matchesSuffix(norm, referencedNorm)) {
            continue;
        }
        let warnings = 0;
        let errors = 0;
        const messages = [];
        for (const msg of entry.messages) {
            if (msg.severity === 1) {
                warnings++;
            }
            else if (msg.severity === 2) {
                errors++;
            }
            if (msg.message && messages.length < MAX_TOP_MESSAGES) {
                messages.push(msg.message);
            }
        }
        const key = findMatchingKey(norm, referencedNorm) ?? norm;
        result.set(key, { warnings, errors, topMessages: messages });
    }
    return result;
}
/** Check if any referenced path is a suffix of (or matches) the given normalized path. */
function matchesSuffix(norm, referencedNorm) {
    for (const ref of referencedNorm) {
        if (norm.endsWith('/' + ref) || ref.endsWith('/' + norm)) {
            return true;
        }
    }
    return false;
}
/** Find the matching referenced key for a normalized lint path. */
function findMatchingKey(norm, referencedNorm) {
    if (referencedNorm.has(norm)) {
        return norm;
    }
    for (const ref of referencedNorm) {
        if (norm.endsWith('/' + ref) || ref.endsWith('/' + norm)) {
            return ref;
        }
    }
    return undefined;
}
/**
 * Read an ESLint-format JSON lint report from disk and extract per-file lint data.
 * Returns an empty map if the file is missing, too large, or unparseable.
 */
function readLintReport(absPath, referencedNorm) {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_LINT_FILE_BYTES) {
            return new Map();
        }
        const content = fs.readFileSync(absPath, 'utf-8');
        return parseEslintJson(content, referencedNorm);
    }
    catch {
        return new Map();
    }
}
//# sourceMappingURL=quality-lint-reader.js.map