"use strict";
/**
 * Load Drift Advisor summary for the Performance → Database tab (DB_13): session meta plus optional sidecar.
 * @see plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md
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
exports.mergeDriftAdvisorDbPanelPayload = void 0;
exports.loadDriftAdvisorDbPanelPayload = loadDriftAdvisorDbPanelPayload;
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const drift_advisor_constants_1 = require("./drift-advisor-constants");
const drift_advisor_db_panel_payload_1 = require("./drift-advisor-db-panel-payload");
var drift_advisor_db_panel_payload_2 = require("./drift-advisor-db-panel-payload");
Object.defineProperty(exports, "mergeDriftAdvisorDbPanelPayload", { enumerable: true, get: function () { return drift_advisor_db_panel_payload_2.mergeDriftAdvisorDbPanelPayload; } });
/**
 * Read `{logBase}.drift-advisor.json` next to the log file and merge with `integrations['saropa-drift-advisor']`.
 */
async function loadDriftAdvisorDbPanelPayload(logUri, integrations) {
    const fromMeta = integrations?.[drift_advisor_constants_1.DRIFT_ADVISOR_META_KEY];
    let sidecar = null;
    try {
        const dir = path.dirname(logUri.fsPath);
        const baseName = path.basename(logUri.fsPath, path.extname(logUri.fsPath));
        const scPath = path.join(dir, `${baseName}.drift-advisor.json`);
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(scPath));
        const parsed = JSON.parse(Buffer.from(raw).toString("utf-8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            sidecar = parsed;
        }
    }
    catch {
        // Sidecar is optional; invalid JSON is ignored.
    }
    return (0, drift_advisor_db_panel_payload_1.mergeDriftAdvisorDbPanelPayload)(fromMeta, sidecar);
}
//# sourceMappingURL=drift-advisor-db-panel-load.js.map