/**
 * Code coverage integration: parses lcov.info, cobertura.xml, or
 * coverage-summary.json at session start and adds coverage line to header and meta.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('coverage');
}

function parseLcov(absPath: string): { linePercent: number; branchPercent?: number } | undefined {
    try {
        const content = fs.readFileSync(absPath, 'utf-8');
        let linesFound = 0;
        let linesHit = 0;
        let branchesFound = 0;
        let branchesHit = 0;
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
            ? Math.round((100 * branchesHit) / branchesFound)
            : undefined;
        return { linePercent, branchPercent };
    } catch {
        return undefined;
    }
}

function parseCobertura(absPath: string): { linePercent: number; branchPercent?: number } | undefined {
    try {
        const content = fs.readFileSync(absPath, 'utf-8');
        const lineRate = content.match(/line-rate="([^"]+)"/)?.[1];
        const branchRate = content.match(/branch-rate="([^"]+)"/)?.[1];
        if (!lineRate) { return undefined; }
        const linePercent = Math.round(parseFloat(lineRate) * 100);
        const branchPercent = branchRate !== undefined ? Math.round(parseFloat(branchRate) * 100) : undefined;
        return { linePercent, branchPercent };
    } catch {
        return undefined;
    }
}

function parseSummaryJson(absPath: string): { linePercent: number; branchPercent?: number } | undefined {
    try {
        const data = JSON.parse(fs.readFileSync(absPath, 'utf-8')) as Record<string, unknown>;
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
        let result: { linePercent: number; branchPercent?: number } | undefined;
        const lower = abs.toLowerCase();
        if (lower.endsWith('.xml')) {
            result = parseCobertura(abs);
        } else if (lower.endsWith('.json')) {
            result = parseSummaryJson(abs);
        } else {
            result = parseLcov(abs);
        }
        if (!result) { return undefined; }
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
};
