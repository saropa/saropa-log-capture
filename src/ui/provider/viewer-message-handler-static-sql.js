"use strict";
/**
 * DB_12: “Possible sources (static)” for a Drift SQL fingerprint via project index (suggestive only).
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
exports.runFindStaticSourcesForSqlFingerprint = runFindStaticSourcesForSqlFingerprint;
const vscode = __importStar(require("vscode"));
const config_1 = require("../../modules/config/config");
const l10n_1 = require("../../l10n");
const drift_sql_static_orm_patterns_1 = require("../../modules/db/drift-sql-static-orm-patterns");
const drift_static_sql_candidates_1 = require("../../modules/db/drift-static-sql-candidates");
const project_indexer_1 = require("../../modules/project-indexer/project-indexer");
const MAX_PICK = 22;
async function runFindStaticSourcesForSqlFingerprint(fingerprint) {
    if (!(0, config_1.getConfig)().staticSqlFromFingerprintEnabled) {
        return;
    }
    const fp = fingerprint.trim();
    if (!fp) {
        return;
    }
    const indexer = (0, project_indexer_1.getGlobalProjectIndexer)();
    if (!indexer) {
        void vscode.window.showInformationMessage((0, l10n_1.t)("msg.staticSqlSourcesNoIndexer"));
        return;
    }
    const plan = (0, drift_sql_static_orm_patterns_1.buildDriftStaticSqlSearchPlan)(fp);
    if (plan.indexerTokens.length === 0) {
        void vscode.window.showInformationMessage((0, l10n_1.t)("msg.staticSqlSourcesNoTokens"));
        return;
    }
    await indexer.getOrRebuild(60_000);
    const ranked = indexer.queryDocEntriesByTokensWithScores([...plan.indexerTokens]);
    if (ranked.length === 0) {
        void vscode.window.showInformationMessage((0, l10n_1.t)("msg.staticSqlSourcesNoMatches", plan.indexerTokens.join(", ")));
        return;
    }
    const picks = await (0, drift_static_sql_candidates_1.buildEnrichedStaticSqlPickList)(plan, ranked, MAX_PICK);
    const items = picks.map((c) => staticSqlQuickPickItem(c, plan.indexerTokens.join(", ")));
    const picked = await vscode.window.showQuickPick(items, {
        title: (0, l10n_1.t)("msg.staticSqlSourcesPickTitle", plan.indexerTokens.slice(0, 6).join(", ")),
        placeHolder: (0, l10n_1.t)("msg.staticSqlSourcesPickPlaceholder"),
    });
    if (!picked) {
        return;
    }
    try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(picked.candidate.doc.uri));
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        const line = Math.max(0, picked.candidate.bestLine1Based - 1);
        const pos = new vscode.Position(line, 0);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(pos, pos);
    }
    catch {
        void vscode.window.showWarningMessage((0, l10n_1.t)("msg.staticSqlSourcesOpenFailed"));
    }
}
function staticSqlQuickPickItem(candidate, tokenSummary) {
    const loc = `L${candidate.bestLine1Based}`;
    const label = `${loc}\u2003${candidate.doc.relativePath}`;
    const hint = candidate.lineHasPrimaryTableShape ? "yes" : "no";
    return {
        label,
        description: (0, l10n_1.t)("msg.staticSqlSourcesPickDescription"),
        detail: (0, l10n_1.t)("msg.staticSqlSourcesPickDetail", hint, String(candidate.bestLineTokenHits), tokenSummary),
        candidate,
    };
}
//# sourceMappingURL=viewer-message-handler-static-sql.js.map