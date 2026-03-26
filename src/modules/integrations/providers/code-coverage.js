"use strict";
/**
 * Code coverage integration: parses lcov.info, cobertura.xml, or
 * coverage-summary.json at session start and adds coverage line to header and meta.
 * Also provides per-file coverage for real-time quality badges on stack frames.
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
exports.codeCoverageProvider = void 0;
exports.getPerFileCoverageMap = getPerFileCoverageMap;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
const coverage_per_file_1 = require("./coverage-per-file");
/** Per-file coverage map, populated at session start, cleared at session end. */
let activePerFileMap;
/** Get the active per-file coverage map (populated after onSessionStartSync). */
function getPerFileCoverageMap() {
    return activePerFileMap;
}
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('coverage');
}
const MAX_COVERAGE_FILE_BYTES = 10 * 1024 * 1024;
/** Read a coverage file from disk if it exists and is under the size limit. */
function readCoverageFile(absPath) {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_COVERAGE_FILE_BYTES) {
            return undefined;
        }
        return fs.readFileSync(absPath, 'utf-8');
    }
    catch {
        return undefined;
    }
}
function parseLcov(content) {
    let linesFound = 0, linesHit = 0, branchesFound = 0, branchesHit = 0;
    for (const line of content.split('\n')) {
        const lf = line.match(/^LF:(\d+)/);
        const lh = line.match(/^LH:(\d+)/);
        const bf = line.match(/^BRF:(\d+)/);
        const bh = line.match(/^BRH:(\d+)/);
        if (lf) {
            linesFound += parseInt(lf[1], 10);
        }
        if (lh) {
            linesHit += parseInt(lh[1], 10);
        }
        if (bf) {
            branchesFound += parseInt(bf[1], 10);
        }
        if (bh) {
            branchesHit += parseInt(bh[1], 10);
        }
    }
    if (linesFound === 0) {
        return undefined;
    }
    const linePercent = Math.round((100 * linesHit) / linesFound);
    const branchPercent = branchesFound > 0
        ? Math.round((100 * branchesHit) / branchesFound) : undefined;
    return { linePercent, branchPercent };
}
function parseCobertura(content) {
    const lineRate = content.match(/line-rate="([^"]+)"/)?.[1];
    const branchRate = content.match(/branch-rate="([^"]+)"/)?.[1];
    if (!lineRate) {
        return undefined;
    }
    const linePercent = Math.round(parseFloat(lineRate) * 100);
    const branchPercent = branchRate !== undefined ? Math.round(parseFloat(branchRate) * 100) : undefined;
    return { linePercent, branchPercent };
}
function parseSummaryJson(content) {
    try {
        const data = JSON.parse(content);
        const total = data.total;
        const lines = total?.lines;
        const branches = total?.branches;
        const linePct = lines?.pct;
        if (linePct === undefined) {
            return undefined;
        }
        const linePercent = Math.round(Number(linePct));
        const branchPercent = branches?.pct !== undefined ? Math.round(Number(branches.pct)) : undefined;
        return { linePercent, branchPercent };
    }
    catch {
        return undefined;
    }
}
exports.codeCoverageProvider = {
    id: 'coverage',
    isEnabled(context) {
        return isEnabled(context);
    },
    onSessionStartSync(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const { workspaceFolder, config } = context;
        const rel = config.integrationsCoverage.reportPath;
        const abs = (0, workspace_path_1.resolveWorkspaceFileUri)(workspaceFolder, rel).fsPath;
        const content = readCoverageFile(abs);
        if (!content) {
            activePerFileMap = undefined;
            return undefined;
        }
        const lower = abs.toLowerCase();
        let result;
        if (lower.endsWith('.xml')) {
            result = parseCobertura(content);
        }
        else if (lower.endsWith('.json')) {
            result = parseSummaryJson(content);
        }
        else {
            result = parseLcov(content);
        }
        if (!result) {
            activePerFileMap = undefined;
            return undefined;
        }
        activePerFileMap = (0, coverage_per_file_1.parsePerFileCoverageContent)(abs, content);
        const branchStr = result.branchPercent !== undefined ? `, ${result.branchPercent}% branches` : '';
        const lines = [
            `Coverage:       ${result.linePercent}% lines${branchStr} (${rel})`,
        ];
        const payload = { linePercent: result.linePercent, branchPercent: result.branchPercent, reportPath: rel };
        if (!config.integrationsCoverage.includeInHeader) {
            return [{ kind: 'meta', key: 'coverage', payload }];
        }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'coverage', payload },
        ];
    },
    async onSessionEnd(context) {
        if (!activePerFileMap || activePerFileMap.size === 0) {
            activePerFileMap = undefined;
            return undefined;
        }
        const entries = {};
        for (const [file, pct] of activePerFileMap) {
            entries[file] = pct;
        }
        activePerFileMap = undefined;
        const json = JSON.stringify({ perFile: entries }, null, 2);
        const filename = `${context.baseFileName}.quality.json`;
        return [
            { kind: 'sidecar', filename, content: json, contentType: 'json' },
        ];
    },
};
//# sourceMappingURL=code-coverage.js.map