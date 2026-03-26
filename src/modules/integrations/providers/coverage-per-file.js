"use strict";
/**
 * Per-file coverage parsing for the code quality integration.
 * Extends the aggregate coverage parsing in code-coverage.ts to return
 * per-file line coverage percentages from lcov, cobertura, or Istanbul formats.
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
exports.parseLcovPerFile = parseLcovPerFile;
exports.parseCoberturaPerFile = parseCoberturaPerFile;
exports.parseSummaryJsonPerFile = parseSummaryJsonPerFile;
exports.parsePerFileCoverageContent = parsePerFileCoverageContent;
exports.parsePerFileCoverage = parsePerFileCoverage;
exports.lookupCoverage = lookupCoverage;
const fs = __importStar(require("fs"));
const MAX_COVERAGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
/** Normalize a file path for consistent map lookups. */
function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/').toLowerCase();
}
/** Strip common workspace-style prefixes to get a relative-ish path. */
function stripPrefix(filePath) {
    const norm = normalizePath(filePath);
    // Strip drive letter (C:/) or leading /
    const stripped = norm.replace(/^[a-z]:\//i, '').replace(/^\//, '');
    return stripped;
}
/** Parse LCOV format into per-file coverage map. */
function parseLcovPerFile(content) {
    const map = new Map();
    let currentFile = '';
    let lf = 0;
    let lh = 0;
    for (const line of content.split('\n')) {
        const sfMatch = line.match(/^SF:(.+)/);
        if (sfMatch) {
            currentFile = sfMatch[1].trim();
            lf = 0;
            lh = 0;
            continue;
        }
        if (line.startsWith('LF:')) {
            lf = parseInt(line.slice(3), 10) || 0;
        }
        if (line.startsWith('LH:')) {
            lh = parseInt(line.slice(3), 10) || 0;
        }
        if (line.startsWith('end_of_record') && currentFile && lf > 0) {
            const pct = Math.round((100 * lh) / lf);
            map.set(stripPrefix(currentFile), pct);
            currentFile = '';
        }
    }
    return map;
}
/** Parse Cobertura XML into per-file coverage map. */
function parseCoberturaPerFile(content) {
    const map = new Map();
    // Match <class> elements; handle filename/line-rate in either attribute order.
    const classRegex = /<class\s[^>]*?(?:filename="([^"]+)"[^>]*?line-rate="([^"]+)"|line-rate="([^"]+)"[^>]*?filename="([^"]+)")/g;
    let m;
    while ((m = classRegex.exec(content)) !== null) {
        const filename = m[1] ?? m[4];
        const rate = m[2] ?? m[3];
        if (!filename || !rate) {
            continue;
        }
        const pct = Math.round(parseFloat(rate) * 100);
        map.set(stripPrefix(filename), pct);
    }
    return map;
}
/** Parse Istanbul coverage-summary.json into per-file coverage map. */
function parseSummaryJsonPerFile(content) {
    const map = new Map();
    let data;
    try {
        data = JSON.parse(content);
    }
    catch {
        return map;
    }
    for (const [key, val] of Object.entries(data)) {
        if (key === 'total') {
            continue;
        }
        const entry = val;
        const lines = entry?.lines;
        if (lines?.pct !== undefined) {
            map.set(stripPrefix(key), Math.round(Number(lines.pct)));
        }
    }
    return map;
}
/** Auto-detect format by extension and parse content into per-file coverage map. */
function parsePerFileCoverageContent(absPath, content) {
    const lower = absPath.toLowerCase();
    if (lower.endsWith('.xml')) {
        return parseCoberturaPerFile(content);
    }
    if (lower.endsWith('.json')) {
        return parseSummaryJsonPerFile(content);
    }
    return parseLcovPerFile(content);
}
/** Read a coverage file and parse into per-file coverage map. */
function parsePerFileCoverage(absPath) {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_COVERAGE_FILE_BYTES) {
            return undefined;
        }
        const content = fs.readFileSync(absPath, 'utf-8');
        return parsePerFileCoverageContent(absPath, content);
    }
    catch {
        return undefined;
    }
}
/**
 * Look up coverage percent for a file path extracted from a stack frame.
 * Tries normalized exact match first, then basename fallback.
 */
function lookupCoverage(coverageMap, filePath) {
    const norm = stripPrefix(filePath);
    // Exact normalized match
    for (const [key, pct] of coverageMap) {
        if (key === norm || key.endsWith('/' + norm) || norm.endsWith('/' + key)) {
            return pct;
        }
    }
    // Basename fallback — only when unambiguous (single match).
    const basename = norm.split('/').pop() ?? '';
    if (!basename) {
        return undefined;
    }
    let found;
    let count = 0;
    for (const [key, pct] of coverageMap) {
        if (key.endsWith('/' + basename) || key === basename) {
            found = pct;
            count++;
            if (count > 1) {
                return undefined;
            } // Ambiguous — multiple files share basename.
        }
    }
    return found;
}
//# sourceMappingURL=coverage-per-file.js.map