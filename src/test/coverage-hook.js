"use strict";
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
/**
 * Coverage hook loaded via `--file` during coverage runs only.
 * Writes Istanbul's `__coverage__` object to `.nyc_output/` so
 * `nyc report` can generate the coverage report.
 *
 * Uses `process.on('exit')` because the `--file` script runs
 * before mocha globals (`after`, `suite`, etc.) are available.
 *
 * This runs inside VS Code's Extension Host process, which is why
 * we use Node `fs` (not `vscode.workspace.fs`).
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
process.on('exit', () => {
    const cov = global.__coverage__;
    if (!cov) {
        return;
    }
    const dir = path.resolve(__dirname, '..', '..', '.nyc_output');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'coverage-final.json'), JSON.stringify(cov));
});
//# sourceMappingURL=coverage-hook.js.map