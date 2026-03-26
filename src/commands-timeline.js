"use strict";
/** Command registration for session timeline. */
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
exports.timelineCommands = timelineCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const timeline_panel_1 = require("./ui/panels/timeline-panel");
/** Register timeline commands. */
function timelineCommands() {
    return [
        vscode.commands.registerCommand('saropaLogCapture.showTimeline', async (item) => {
            if (item?.uri) {
                await (0, timeline_panel_1.showTimeline)(item.uri);
            }
            else {
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.rightClickForTimeline'));
            }
        }),
    ];
}
//# sourceMappingURL=commands-timeline.js.map