"use strict";
/**
 * Saropa Log Capture configuration — single source of truth for all extension settings.
 *
 * Reads from VS Code workspace/global config (section "saropaLogCapture"), applies
 * defaults, and exposes a typed SaropaLogCaptureConfig. Call getConfig() when you need
 * current values; config is not cached across settings changes.
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
exports.shouldRedactEnvVar = exports.getFileTypeGlob = exports.readTrackedFiles = exports.isTrackedFile = void 0;
exports.getConfig = getConfig;
exports.getLogDirectoryUri = getLogDirectoryUri;
exports.getReportFolderUri = getReportFolderUri;
exports.getSaropaDirUri = getSaropaDirUri;
exports.getSaropaCacheCrashlyticsUri = getSaropaCacheCrashlyticsUri;
exports.getSaropaIndexDirUri = getSaropaIndexDirUri;
exports.viewerDbDetectorTogglesFromConfig = viewerDbDetectorTogglesFromConfig;
exports.errorRateConfigFromConfig = errorRateConfigFromConfig;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("node:path"));
const drift_db_repeat_thresholds_1 = require("../db/drift-db-repeat-thresholds");
const drift_db_slow_burst_thresholds_1 = require("../db/drift-db-slow-burst-thresholds");
const file_splitter_1 = require("../misc/file-splitter");
const integration_config_1 = require("./integration-config");
const config_types_1 = require("./config-types");
const config_validation_1 = require("./config-validation");
const SECTION = "saropaLogCapture";
const DEFAULT_CATEGORIES = ["console", "stdout", "stderr"];
const DEFAULT_FILE_TYPES = [".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html"];
const DEFAULT_WATCH_PATTERNS = [
    { keyword: "error", alert: "flash" },
    { keyword: "exception", alert: "badge" },
    { keyword: "warning", alert: "badge" },
];
function normalizeWatchPatterns(raw) {
    if (!Array.isArray(raw)) {
        return DEFAULT_WATCH_PATTERNS;
    }
    const alertValues = ["flash", "badge", "none"];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const o = item;
        const keyword = typeof o.keyword === "string" ? o.keyword.trim() : "";
        if (!keyword) {
            continue;
        }
        const alert = typeof o.alert === "string" && alertValues.includes(o.alert)
            ? o.alert
            : "badge";
        out.push({ keyword, alert });
    }
    return out.length > 0 ? out : DEFAULT_WATCH_PATTERNS;
}
function asObjectRecord(value) {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    return value;
}
function readOptionalString(o, key) {
    const v = o[key];
    return typeof v === "string" ? v : undefined;
}
function readOptionalScope(o) {
    const v = o.scope;
    if (v === "line") {
        return "line";
    }
    if (v === "keyword") {
        return "keyword";
    }
    return undefined;
}
function readPattern(o) {
    const v = o.pattern;
    if (typeof v !== "string") {
        return undefined;
    }
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}
function readBooleanOrFalse(o, key) {
    const v = o[key];
    return typeof v === "boolean" ? v : false;
}
function normalizeHighlightRuleItem(item) {
    const o = asObjectRecord(item);
    if (!o) {
        return undefined;
    }
    const pattern = readPattern(o);
    if (!pattern) {
        return undefined;
    }
    return {
        pattern,
        color: readOptionalString(o, "color"),
        label: readOptionalString(o, "label"),
        bold: readBooleanOrFalse(o, "bold"),
        italic: readBooleanOrFalse(o, "italic"),
        scope: readOptionalScope(o),
        backgroundColor: readOptionalString(o, "backgroundColor"),
    };
}
function normalizeHighlightRules(raw) {
    if (!Array.isArray(raw)) {
        return (0, config_types_1.defaultHighlightRules)();
    }
    const out = [];
    for (const item of raw) {
        const rule = normalizeHighlightRuleItem(item);
        if (rule) {
            out.push(rule);
        }
    }
    return out.length > 0 ? out : (0, config_types_1.defaultHighlightRules)();
}
function normalizeAutoTagRules(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item) => {
        if (!item || typeof item !== "object") {
            return null;
        }
        const o = item;
        const pattern = typeof o.pattern === "string" ? o.pattern.trim() : "";
        const tag = typeof o.tag === "string" ? o.tag.trim() : "";
        if (!pattern || !tag) {
            return null;
        }
        return { pattern, tag };
    })
        .filter((r) => r !== null);
}
function getConfig() {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    const maxLines = (0, config_validation_1.clamp)(cfg.get("maxLines"), 1000, 10_000_000, 100000);
    const viewerMaxLinesRaw = cfg.get("viewerMaxLines");
    const viewerMaxLines = typeof viewerMaxLinesRaw === "number" && Number.isFinite(viewerMaxLinesRaw) && viewerMaxLinesRaw >= 0
        ? Math.min(viewerMaxLinesRaw, maxLines)
        : 0;
    return {
        enabled: (0, config_validation_1.ensureBoolean)(cfg.get("enabled"), true),
        aiActivity: {
            enabled: (0, config_validation_1.ensureBoolean)(cfg.get("aiActivity.enabled"), true),
            autoDetect: (0, config_validation_1.ensureBoolean)(cfg.get("aiActivity.autoDetect"), true),
            lookbackMinutes: (0, config_validation_1.clamp)(cfg.get("aiActivity.lookbackMinutes"), 1, 1440, 30),
            showPrompts: (0, config_validation_1.ensureBoolean)(cfg.get("aiActivity.showPrompts"), true),
            showReadOperations: (0, config_validation_1.ensureBoolean)(cfg.get("aiActivity.showReadOperations"), false),
            showSystemWarnings: (0, config_validation_1.ensureBoolean)(cfg.get("aiActivity.showSystemWarnings"), true),
        },
        categories: (0, config_validation_1.ensureStringArray)(cfg.get("categories"), DEFAULT_CATEGORIES),
        maxLines,
        viewerMaxLines,
        includeTimestamp: (0, config_validation_1.ensureBoolean)(cfg.get("includeTimestamp"), true),
        format: (0, config_validation_1.ensureEnum)(cfg.get("format"), ["plaintext", "html"], "plaintext"),
        logDirectory: (() => {
            const v = cfg.get("logDirectory");
            return typeof v === "string" && v.trim().length > 0 ? v.trim() : "reports";
        })(),
        reportFolder: (() => {
            const v = cfg.get("reportFolder");
            return typeof v === "string" && v.trim().length > 0 ? v.trim() : "bugs";
        })(),
        lintReportImpactLevel: (0, config_validation_1.ensureEnum)(cfg.get("lintReportImpactLevel"), ["essential", "recommended", "full"], "recommended"),
        autoOpen: (0, config_validation_1.ensureBoolean)(cfg.get("autoOpen"), false),
        maxLogFiles: (0, config_validation_1.ensureNonNegative)(cfg.get("maxLogFiles"), 0),
        gitignoreCheck: (0, config_validation_1.ensureBoolean)(cfg.get("gitignoreCheck"), true),
        redactEnvVars: (0, config_validation_1.ensureStringArray)(cfg.get("redactEnvVars"), []),
        exclusions: (0, config_validation_1.ensureStringArray)(cfg.get("exclusions"), []),
        autoHidePatterns: (0, config_validation_1.ensureStringArray)(cfg.get("autoHidePatterns"), []),
        showElapsedTime: (0, config_validation_1.ensureBoolean)(cfg.get("showElapsedTime"), false),
        includeSourceLocation: (0, config_validation_1.ensureBoolean)(cfg.get("includeSourceLocation"), false),
        includeElapsedTime: (0, config_validation_1.ensureBoolean)(cfg.get("includeElapsedTime"), false),
        showDecorations: (0, config_validation_1.ensureBoolean)(cfg.get("showDecorations"), true),
        slowGapThreshold: (0, config_validation_1.clamp)(cfg.get("slowGapThreshold"), 0, 86_400_000, 1000),
        watchPatterns: normalizeWatchPatterns(cfg.get("watchPatterns")),
        splitRules: (0, file_splitter_1.parseSplitRules)(cfg.get("splitRules") ?? {}),
        autoTagRules: normalizeAutoTagRules(cfg.get("autoTagRules")),
        highlightRules: normalizeHighlightRules(cfg.get("highlightRules")),
        captureAll: (0, config_validation_1.ensureBoolean)(cfg.get("captureAll"), true),
        filterContextLines: (0, config_validation_1.clamp)(cfg.get("filterContextLines"), 0, 100, 3),
        contextViewLines: (0, config_validation_1.clamp)(cfg.get("contextViewLines"), 0, 100, 10),
        copyContextLines: (0, config_validation_1.clamp)(cfg.get("copyContextLines"), 0, 20, 3),
        suppressTransientErrors: (0, config_validation_1.ensureBoolean)(cfg.get("suppressTransientErrors"), false),
        breakOnCritical: (0, config_validation_1.ensureBoolean)(cfg.get("breakOnCritical"), false),
        minimapShowInfoMarkers: (0, config_validation_1.ensureBoolean)(cfg.get("minimapShowInfoMarkers"), false),
        minimapShowSqlDensity: (0, config_validation_1.ensureBoolean)(cfg.get("minimapShowSqlDensity"), true),
        minimapWidth: (0, config_validation_1.ensureEnum)(cfg.get("minimapWidth"), ["small", "medium", "large"], "medium"),
        showScrollbar: (0, config_validation_1.ensureBoolean)(cfg.get("showScrollbar"), false),
        viewerAlwaysShowSearchMatchOptions: (0, config_validation_1.ensureBoolean)(cfg.get("viewerAlwaysShowSearchMatchOptions"), false),
        viewerRepeatThresholds: (0, drift_db_repeat_thresholds_1.normalizeViewerRepeatThresholds)({
            globalMinCount: cfg.get("repeatCollapseGlobalMinCount"),
            readMinCount: cfg.get("repeatCollapseReadMinCount"),
            transactionMinCount: cfg.get("repeatCollapseTransactionMinCount"),
            dmlMinCount: cfg.get("repeatCollapseDmlMinCount"),
        }),
        viewerDbInsightsEnabled: (0, config_validation_1.ensureBoolean)(cfg.get("viewerDbInsightsEnabled"), true),
        staticSqlFromFingerprintEnabled: (0, config_validation_1.ensureBoolean)(cfg.get("staticSqlFromFingerprint.enabled"), true),
        viewerDbDetectorNPlusOneEnabled: (0, config_validation_1.ensureBoolean)(cfg.get("viewerDbDetectorNPlusOneEnabled"), true),
        viewerDbDetectorSlowBurstEnabled: (0, config_validation_1.ensureBoolean)(cfg.get("viewerDbDetectorSlowBurstEnabled"), true),
        viewerDbDetectorBaselineHintsEnabled: (0, config_validation_1.ensureBoolean)(cfg.get("viewerDbDetectorBaselineHintsEnabled"), true),
        viewerSlowBurstThresholds: (0, drift_db_slow_burst_thresholds_1.normalizeViewerSlowBurstThresholds)({
            slowQueryMs: cfg.get("viewerSlowBurstSlowQueryMs"),
            burstMinCount: cfg.get("viewerSlowBurstMinCount"),
            burstWindowMs: cfg.get("viewerSlowBurstWindowMs"),
            cooldownMs: cfg.get("viewerSlowBurstCooldownMs"),
        }),
        viewerSqlPatternChipMinCount: (0, config_validation_1.clamp)(cfg.get("viewerSqlPatternChipMinCount"), 1, 50, 2),
        viewerSqlPatternMaxChips: (0, config_validation_1.clamp)(cfg.get("viewerSqlPatternMaxChips"), 1, 100, 20),
        deemphasizeFrameworkLevels: (0, config_validation_1.ensureBoolean)(cfg.get("deemphasizeFrameworkLevels"), false),
        levelDetection: (0, config_validation_1.ensureEnum)(cfg.get("levelDetection"), ["strict", "loose"], "strict"),
        smartBookmarks: {
            suggestFirstError: (0, config_validation_1.ensureBoolean)(cfg.get("smartBookmarks.suggestFirstError"), true),
            suggestFirstWarning: (0, config_validation_1.ensureBoolean)(cfg.get("smartBookmarks.suggestFirstWarning"), false),
        },
        verboseDap: (0, config_validation_1.ensureBoolean)(cfg.get("verboseDap"), false),
        diagnosticCapture: (0, config_validation_1.ensureBoolean)(cfg.get("diagnosticCapture"), false),
        errorRateBucketSize: (0, config_validation_1.ensureEnum)(cfg.get("errorRateBucketSize"), ["auto", "10s", "30s", "1m", "5m"], "auto"),
        errorRateShowWarnings: (0, config_validation_1.ensureBoolean)(cfg.get("errorRateShowWarnings"), true),
        errorRateDetectSpikes: (0, config_validation_1.ensureBoolean)(cfg.get("errorRateDetectSpikes"), true),
        fileTypes: (0, config_validation_1.ensureStringArray)(cfg.get("fileTypes"), DEFAULT_FILE_TYPES),
        tailPatterns: (0, config_validation_1.ensureStringArray)(cfg.get("tailPatterns"), ["**/*.log"]),
        docsScanDirs: (0, config_validation_1.ensureStringArray)(cfg.get("docsScanDirs"), ["bugs", "docs"]),
        includeSubfolders: (0, config_validation_1.ensureBoolean)(cfg.get("includeSubfolders"), true),
        treeRefreshInterval: (0, config_validation_1.ensureNonNegative)(cfg.get("treeRefreshInterval"), 0),
        sessionListPageSize: (0, config_validation_1.clamp)(cfg.get("sessionListPageSize"), 10, 500, 100),
        iconBarPosition: (0, config_validation_1.ensureEnum)(cfg.get("iconBarPosition"), ["left", "right"], "left"),
        organizeFolders: (0, config_validation_1.ensureBoolean)(cfg.get("organizeFolders"), true),
        integrationsAdapters: (0, config_validation_1.ensureStringArray)(cfg.get("integrations.adapters"), ["packages", "performance"]),
        ...(0, integration_config_1.getIntegrationConfig)(cfg),
        projectIndex: (0, integration_config_1.getProjectIndexConfig)(cfg),
        replay: {
            defaultMode: (0, config_validation_1.ensureEnum)(cfg.get("replay.defaultMode"), ["timed", "fast"], "timed"),
            /* 0.1–10 to match viewer speed dropdown (0.1x–10x). */
            defaultSpeed: (0, config_validation_1.clamp)(cfg.get("replay.defaultSpeed"), 0.1, 10, 1),
            minLineDelayMs: (0, config_validation_1.clamp)(cfg.get("replay.minLineDelayMs"), 0, 1000, 10),
            maxDelayMs: (0, config_validation_1.clamp)(cfg.get("replay.maxDelayMs"), 1000, 300000, 30000),
        },
    };
}
function getLogDirectoryUri(workspaceFolder) {
    const config = getConfig();
    if (path.isAbsolute(config.logDirectory)) {
        return vscode.Uri.file(config.logDirectory);
    }
    if (!workspaceFolder?.uri) {
        return vscode.Uri.file(path.join(process.cwd(), config.logDirectory));
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, config.logDirectory);
}
/** URI for the bug report output folder. */
function getReportFolderUri(workspaceFolder) {
    const config = getConfig();
    if (path.isAbsolute(config.reportFolder)) {
        return vscode.Uri.file(config.reportFolder);
    }
    if (!workspaceFolder?.uri) {
        return vscode.Uri.file(path.join(process.cwd(), config.reportFolder));
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, config.reportFolder);
}
/** URI for extension tooling root (.saropa/). Index and caches live under here. */
function getSaropaDirUri(workspaceFolder) {
    if (!workspaceFolder?.uri) {
        return vscode.Uri.file(path.join(process.cwd(), '.saropa'));
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, '.saropa');
}
/** URI for Crashlytics cache directory (.saropa/cache/crashlytics/). */
function getSaropaCacheCrashlyticsUri(workspaceFolder) {
    return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'cache', 'crashlytics');
}
/** URI for project index directory (.saropa/index/). */
function getSaropaIndexDirUri(workspaceFolder) {
    return vscode.Uri.joinPath(getSaropaDirUri(workspaceFolder), 'index');
}
/** Per-detector flags for the log viewer DB pipeline (when master DB insights is on). */
function viewerDbDetectorTogglesFromConfig(cfg) {
    return {
        nPlusOneEnabled: cfg.viewerDbDetectorNPlusOneEnabled,
        slowBurstEnabled: cfg.viewerDbDetectorSlowBurstEnabled,
        baselineHintsEnabled: cfg.viewerDbDetectorBaselineHintsEnabled,
    };
}
/** Error rate chart config for the viewer (bucketSize, showWarnings, detectSpikes). */
function errorRateConfigFromConfig(cfg) {
    return {
        bucketSize: cfg.errorRateBucketSize,
        showWarnings: cfg.errorRateShowWarnings,
        detectSpikes: cfg.errorRateDetectSpikes,
    };
}
var config_file_utils_1 = require("./config-file-utils");
Object.defineProperty(exports, "isTrackedFile", { enumerable: true, get: function () { return config_file_utils_1.isTrackedFile; } });
Object.defineProperty(exports, "readTrackedFiles", { enumerable: true, get: function () { return config_file_utils_1.readTrackedFiles; } });
Object.defineProperty(exports, "getFileTypeGlob", { enumerable: true, get: function () { return config_file_utils_1.getFileTypeGlob; } });
Object.defineProperty(exports, "shouldRedactEnvVar", { enumerable: true, get: function () { return config_file_utils_1.shouldRedactEnvVar; } });
//# sourceMappingURL=config.js.map