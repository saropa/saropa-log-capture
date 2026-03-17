/**
 * Code coverage integration: parses lcov.info, cobertura.xml, or
 * coverage-summary.json at session start and adds coverage line to header and meta.
 * Also provides per-file coverage for real-time quality badges on stack frames.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { type CoverageMap, parsePerFileCoverageContent } from './coverage-per-file';

/** Per-file coverage map, populated at session start, cleared at session end. */
let activePerFileMap: CoverageMap | undefined;

/** Get the active per-file coverage map (populated after onSessionStartSync). */
export function getPerFileCoverageMap(): CoverageMap | undefined {
    return activePerFileMap;
}

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('coverage');
}

const MAX_COVERAGE_FILE_BYTES = 10 * 1024 * 1024;

/** Read a coverage file from disk if it exists and is under the size limit. */
function readCoverageFile(absPath: string): string | undefined {
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > MAX_COVERAGE_FILE_BYTES) { return undefined; }
        return fs.readFileSync(absPath, 'utf-8');
    } catch {
        return undefined;
    }
}

function parseLcov(content: string): { linePercent: number; branchPercent?: number } | undefined {
    let linesFound = 0, linesHit = 0, branchesFound = 0, branchesHit = 0;
    for (const line of content.split('\n')) {
        const lf = line.match(/^LF:(\d+)/);
        const lh = line.match(/^LH:(\d+)/);
        const bf = line.match(/^BRF:(\d+)/);
        const bh = line.match(/^BRH:(\d+)/);
        if (lf) { linesFound += parseInt(lf[1], 10); }
        if (lh) { linesHit += parseInt(lh[1], 10); }
        if (bf) { branchesFound += parseInt(bf[1], 10); }
        if (bh) { branchesHit += parseInt(bh[1], 10); }
    }
    if (linesFound === 0) { return undefined; }
    const linePercent = Math.round((100 * linesHit) / linesFound);
    const branchPercent = branchesFound > 0
        ? Math.round((100 * branchesHit) / branchesFound) : undefined;
    return { linePercent, branchPercent };
}

function parseCobertura(content: string): { linePercent: number; branchPercent?: number } | undefined {
    const lineRate = content.match(/line-rate="([^"]+)"/)?.[1];
    const branchRate = content.match(/branch-rate="([^"]+)"/)?.[1];
    if (!lineRate) { return undefined; }
    const linePercent = Math.round(parseFloat(lineRate) * 100);
    const branchPercent = branchRate !== undefined ? Math.round(parseFloat(branchRate) * 100) : undefined;
    return { linePercent, branchPercent };
}

function parseSummaryJson(content: string): { linePercent: number; branchPercent?: number } | undefined {
    try {
        const data = JSON.parse(content) as Record<string, unknown>;
        const total = data.total as Record<string, unknown> | undefined;
        const lines = total?.lines as { pct?: number } | undefined;
        const branches = total?.branches as { pct?: number } | undefined;
        const linePct = lines?.pct;
        if (linePct === undefined) { return undefined; }
        const linePercent = Math.round(Number(linePct));
        const branchPercent = branches?.pct !== undefined ? Math.round(Number(branches.pct)) : undefined;
        return { linePercent, branchPercent };
    } catch {
        return undefined;
    }
}

export const codeCoverageProvider: IntegrationProvider = {
    id: 'coverage',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { workspaceFolder, config } = context;
        const rel = config.integrationsCoverage.reportPath;
        const abs = resolveWorkspaceFileUri(workspaceFolder, rel).fsPath;
        const content = readCoverageFile(abs);
        if (!content) { activePerFileMap = undefined; return undefined; }
        const lower = abs.toLowerCase();
        let result: { linePercent: number; branchPercent?: number } | undefined;
        if (lower.endsWith('.xml')) { result = parseCobertura(content); }
        else if (lower.endsWith('.json')) { result = parseSummaryJson(content); }
        else { result = parseLcov(content); }
        if (!result) { activePerFileMap = undefined; return undefined; }
        activePerFileMap = parsePerFileCoverageContent(abs, content);
        const branchStr = result.branchPercent !== undefined ? `, ${result.branchPercent}% branches` : '';
        const lines: string[] = [
            `Coverage:       ${result.linePercent}% lines${branchStr} (${rel})`,
        ];
        const payload = { linePercent: result.linePercent, branchPercent: result.branchPercent, reportPath: rel };
        if (!config.integrationsCoverage.includeInHeader) { return [{ kind: 'meta', key: 'coverage', payload }]; }
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'coverage', payload },
        ];
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!activePerFileMap || activePerFileMap.size === 0) {
            activePerFileMap = undefined;
            return undefined;
        }
        const entries: Record<string, number> = {};
        for (const [file, pct] of activePerFileMap) { entries[file] = pct; }
        activePerFileMap = undefined;
        const json = JSON.stringify({ perFile: entries }, null, 2);
        const filename = `${context.baseFileName}.quality.json`;
        return [
            { kind: 'sidecar', filename, content: json, contentType: 'json' },
        ];
    },
};
