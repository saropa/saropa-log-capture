"use strict";
/**
 * Integration and project-index config loading. Extracted to keep config.ts under line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIntegrationConfig = getIntegrationConfig;
exports.getProjectIndexConfig = getProjectIndexConfig;
const config_validation_1 = require("./config-validation");
/** Read a non-negative number from config; return default if missing or invalid. */
function configNonNegative(cfg, key, defaultVal) {
    const v = cfg.get(key);
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}
function readStringOrDefault(cfg, key, defaultVal) {
    const v = cfg.get(key);
    return typeof v === 'string' ? v : defaultVal;
}
function readTrimmedStringOrDefault(cfg, key, defaultVal) {
    const v = cfg.get(key);
    return typeof v === 'string' ? v.trim() : defaultVal;
}
function readTrimmedNonEmptyStringOrDefault(cfg, key, defaultVal) {
    const t = readTrimmedStringOrDefault(cfg, key, defaultVal);
    return t.length > 0 ? t : defaultVal;
}
function parseProjectIndexSources(rawSources, docsDirs) {
    if (!Array.isArray(rawSources)) {
        return docsDirs.map((dir) => ({ path: dir, fileTypes: ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'], enabled: true }));
    }
    if (rawSources.length === 0) {
        return docsDirs.map((dir) => ({ path: dir, fileTypes: ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'], enabled: true }));
    }
    const sources = [];
    for (const s of rawSources) {
        if (!s) {
            continue;
        }
        if (typeof s !== 'object') {
            continue;
        }
        const o = s;
        let pathVal = '';
        if (typeof o.path === 'string') {
            pathVal = o.path.trim();
        }
        if (!pathVal) {
            continue;
        }
        let fileTypes = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'];
        if (Array.isArray(o.fileTypes)) {
            fileTypes = o.fileTypes.filter((x) => typeof x === 'string');
        }
        sources.push({ path: pathVal, fileTypes, enabled: o.enabled !== false });
    }
    return sources;
}
function getIntegrationConfig(cfg) {
    return {
        integrationsBuildCi: {
            source: (0, config_validation_1.ensureEnum)(cfg.get('integrations.buildCi.source'), ['file', 'github', 'azure', 'gitlab'], 'file'),
            buildInfoPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.buildCi.buildInfoPath', '.saropa/last-build.json'),
            fileMaxAgeMinutes: (0, config_validation_1.clamp)(cfg.get('integrations.buildCi.fileMaxAgeMinutes'), 1, 1440, 60),
            azureOrg: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.azureOrg', ''),
            azureProject: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.azureProject', ''),
            gitlabProjectId: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.gitlabProjectId', ''),
            gitlabBaseUrl: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.buildCi.gitlabBaseUrl', 'https://gitlab.com'),
        },
        integrationsGit: {
            describeInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.describeInHeader'), true),
            uncommittedInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.uncommittedInHeader'), true),
            stashInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.stashInHeader'), false),
            blameOnNavigate: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.blameOnNavigate'), true),
            includeLineHistoryInMeta: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.includeLineHistoryInMeta'), false),
            commitLinks: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.git.commitLinks'), true),
        },
        integrationsEnvironment: {
            includeEnvChecksum: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.environment.includeEnvChecksum'), false),
            configFiles: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.environment.configFiles'), []),
            includeInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.environment.includeInHeader'), true),
        },
        integrationsTestResults: {
            source: (0, config_validation_1.ensureEnum)(cfg.get('integrations.testResults.source'), ['file', 'junit'], 'file'),
            lastRunPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.testResults.lastRunPath', '.saropa/last-test-run.json'),
            junitPath: readStringOrDefault(cfg, 'integrations.testResults.junitPath', ''),
            fileMaxAgeHours: (0, config_validation_1.clamp)(cfg.get('integrations.testResults.fileMaxAgeHours'), 1, 168, 24),
            includeFailedListInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.testResults.includeFailedListInHeader'), false),
        },
        integrationsCoverage: {
            reportPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.coverage.reportPath', 'coverage/lcov.info'),
            includeInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.coverage.includeInHeader'), true),
        },
        integrationsCodeQuality: {
            lintReportPath: readTrimmedStringOrDefault(cfg, 'integrations.codeQuality.lintReportPath', ''),
            scanComments: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.codeQuality.scanComments'), false),
            coverageStaleMaxHours: configNonNegative(cfg, 'integrations.codeQuality.coverageStaleMaxHours', 24),
            includeInBugReport: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.codeQuality.includeInBugReport'), false),
        },
        integrationsCrashDumps: {
            searchPaths: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.crashDumps.searchPaths'), []),
            extensions: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.crashDumps.extensions'), ['.dmp', '.mdmp', '.core']),
            leadMinutes: configNonNegative(cfg, 'integrations.crashDumps.leadMinutes', 1),
            lagMinutes: configNonNegative(cfg, 'integrations.crashDumps.lagMinutes', 5),
            maxFiles: (0, config_validation_1.clamp)(cfg.get('integrations.crashDumps.maxFiles'), 1, 100, 20),
            includeInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.crashDumps.includeInHeader'), true),
            copyToSession: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.crashDumps.copyToSession'), false),
        },
        integrationsWindowsEvents: {
            logs: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.windowsEvents.logs'), ['Application', 'System']),
            levels: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.windowsEvents.levels'), ['Critical', 'Error', 'Warning']),
            leadMinutes: configNonNegative(cfg, 'integrations.windowsEvents.leadMinutes', 2),
            lagMinutes: configNonNegative(cfg, 'integrations.windowsEvents.lagMinutes', 5),
            maxEvents: (0, config_validation_1.clamp)(cfg.get('integrations.windowsEvents.maxEvents'), 1, 500, 200),
        },
        integrationsDocker: {
            runtime: (0, config_validation_1.ensureEnum)(cfg.get('integrations.docker.runtime'), ['docker', 'podman'], 'docker'),
            containerId: readStringOrDefault(cfg, 'integrations.docker.containerId', ''),
            containerNamePattern: readStringOrDefault(cfg, 'integrations.docker.containerNamePattern', ''),
            captureLogs: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.docker.captureLogs'), true),
            maxLogLines: (0, config_validation_1.clamp)(cfg.get('integrations.docker.maxLogLines'), 100, 100000, 20000),
            includeInspect: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.docker.includeInspect'), false),
        },
        integrationsLoki: {
            enabled: (0, config_validation_1.ensureBoolean)(cfg.get('loki.enabled'), false),
            pushUrl: readTrimmedStringOrDefault(cfg, 'loki.pushUrl', ''),
        },
        integrationsPerformance: {
            snapshotAtStart: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.performance.snapshotAtStart'), true),
            sampleDuringSession: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.performance.sampleDuringSession'), false),
            sampleIntervalSeconds: (0, config_validation_1.clamp)(cfg.get('integrations.performance.sampleIntervalSeconds'), 1, 300, 5),
            includeInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.performance.includeInHeader'), true),
            profilerOutputPath: readTrimmedStringOrDefault(cfg, 'integrations.performance.profilerOutputPath', ''),
            processMetrics: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.performance.processMetrics'), false),
        },
        integrationsTerminal: {
            whichTerminals: (0, config_validation_1.ensureEnum)(cfg.get('integrations.terminal.whichTerminals'), ['all', 'active', 'linked'], 'active'),
            writeSidecar: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.terminal.writeSidecar'), true),
            prefixTimestamp: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.terminal.prefixTimestamp'), true),
            maxLines: (0, config_validation_1.clamp)(cfg.get('integrations.terminal.maxLines'), 1000, 500000, 50000),
        },
        integrationsLinuxLogs: {
            when: (0, config_validation_1.ensureEnum)(cfg.get('integrations.linuxLogs.when'), ['wsl', 'remote', 'always'], 'wsl'),
            sources: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.linuxLogs.sources'), ['dmesg', 'journalctl']),
            leadMinutes: configNonNegative(cfg, 'integrations.linuxLogs.leadMinutes', 2),
            lagMinutes: configNonNegative(cfg, 'integrations.linuxLogs.lagMinutes', 5),
            maxLines: (0, config_validation_1.clamp)(cfg.get('integrations.linuxLogs.maxLines'), 100, 10000, 1000),
            wslDistro: readTrimmedStringOrDefault(cfg, 'integrations.linuxLogs.wslDistro', ''),
        },
        integrationsExternalLogs: {
            paths: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.externalLogs.paths'), []),
            writeSidecars: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.externalLogs.writeSidecars'), true),
            prefixLines: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.externalLogs.prefixLines'), true),
            maxLinesPerFile: (0, config_validation_1.clamp)(cfg.get('integrations.externalLogs.maxLinesPerFile'), 100, 1000000, 10000),
        },
        integrationsSecurity: {
            windowsSecurityLog: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.security.windowsSecurityLog'), false),
            auditLogPath: readTrimmedStringOrDefault(cfg, 'integrations.security.auditLogPath', ''),
            redactSecurityEvents: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.security.redactSecurityEvents'), true),
            includeSummaryInHeader: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.security.includeSummaryInHeader'), false),
            includeInBugReport: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.security.includeInBugReport'), false),
        },
        integrationsDatabase: {
            mode: (0, config_validation_1.ensureEnum)(cfg.get('integrations.database.mode'), ['parse', 'file', 'api'], 'parse'),
            queryLogPath: readTrimmedStringOrDefault(cfg, 'integrations.database.queryLogPath', ''),
            requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.database.requestIdPattern', ''),
            queryBlockPattern: readTrimmedStringOrDefault(cfg, 'integrations.database.queryBlockPattern', ''),
            timeWindowSeconds: (0, config_validation_1.clamp)(cfg.get('integrations.database.timeWindowSeconds'), 1, 120, 5),
            maxQueriesPerLookup: (0, config_validation_1.clamp)(cfg.get('integrations.database.maxQueriesPerLookup'), 1, 200, 20),
        },
        integrationsHttp: {
            requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.http.requestIdPattern', ''),
            requestLogPath: readTrimmedStringOrDefault(cfg, 'integrations.http.requestLogPath', ''),
            timeWindowSeconds: (0, config_validation_1.clamp)(cfg.get('integrations.http.timeWindowSeconds'), 1, 120, 10),
            maxRequestsPerSession: (0, config_validation_1.clamp)(cfg.get('integrations.http.maxRequestsPerSession'), 10, 5000, 500),
        },
        integrationsBrowser: {
            mode: (0, config_validation_1.ensureEnum)(cfg.get('integrations.browser.mode'), ['file', 'cdp'], 'file'),
            browserLogPath: readTrimmedStringOrDefault(cfg, 'integrations.browser.browserLogPath', ''),
            browserLogFormat: (0, config_validation_1.ensureEnum)(cfg.get('integrations.browser.browserLogFormat'), ['jsonl', 'json'], 'jsonl'),
            maxEvents: (0, config_validation_1.clamp)(cfg.get('integrations.browser.maxEvents'), 100, 100000, 10000),
            cdpUrl: readTrimmedStringOrDefault(cfg, 'integrations.browser.cdpUrl', ''),
            includeNetwork: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.browser.includeNetwork'), false),
            requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.browser.requestIdPattern', ''),
        },
        integrationsAdbLogcat: {
            device: readTrimmedStringOrDefault(cfg, 'integrations.adbLogcat.device', ''),
            tagFilters: (0, config_validation_1.ensureStringArray)(cfg.get('integrations.adbLogcat.tagFilters'), []),
            minLevel: (0, config_validation_1.ensureEnum)(cfg.get('integrations.adbLogcat.minLevel'), ['V', 'D', 'I', 'W', 'E', 'F', 'A'], 'V'),
            filterByPid: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.adbLogcat.filterByPid'), true),
            maxBufferLines: (0, config_validation_1.clamp)(cfg.get('integrations.adbLogcat.maxBufferLines'), 1000, 500000, 50000),
            writeSidecar: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.adbLogcat.writeSidecar'), true),
            captureDeviceOther: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.adbLogcat.captureDeviceOther'), false),
        },
        integrationsUnifiedLog: {
            writeAtSessionEnd: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.unifiedLog.writeAtSessionEnd'), false),
            maxLinesPerSource: (0, config_validation_1.clamp)(cfg.get('integrations.unifiedLog.maxLinesPerSource'), 1000, 500000, 50000),
        },
        integrationsFlutterCrashLogs: {
            deleteOriginals: (0, config_validation_1.ensureBoolean)(cfg.get('integrations.flutterCrashLogs.deleteOriginals'), true),
            leadMinutes: configNonNegative(cfg, 'integrations.flutterCrashLogs.leadMinutes', 1),
            lagMinutes: configNonNegative(cfg, 'integrations.flutterCrashLogs.lagMinutes', 5),
        },
    };
}
function getProjectIndexConfig(cfg) {
    const rawSources = cfg.get("projectIndex.sources");
    const docsDirs = (0, config_validation_1.ensureStringArray)(cfg.get("docsScanDirs"), ["bugs", "docs"]);
    const sources = parseProjectIndexSources(rawSources, docsDirs);
    return {
        enabled: (0, config_validation_1.ensureBoolean)(cfg.get('projectIndex.enabled'), true),
        sources,
        includeRootFiles: (0, config_validation_1.ensureBoolean)(cfg.get('projectIndex.includeRootFiles'), true),
        includeReports: (0, config_validation_1.ensureBoolean)(cfg.get('projectIndex.includeReports'), true),
        maxFilesPerSource: (0, config_validation_1.clamp)(cfg.get('projectIndex.maxFilesPerSource'), 10, 1000, 100),
        refreshInterval: (0, config_validation_1.clamp)(cfg.get('projectIndex.refreshInterval'), 0, 3600, 0),
    };
}
//# sourceMappingURL=integration-config.js.map