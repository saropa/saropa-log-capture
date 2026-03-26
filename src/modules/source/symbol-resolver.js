"use strict";
/** Symbol resolver — finds definitions of class names via VS Code workspace symbol provider. */
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
exports.resolveSymbols = resolveSymbols;
const vscode = __importStar(require("vscode"));
const maxQueries = 5;
const maxResultsPerQuery = 10;
const kindNames = {
    4: 'Class', 5: 'Method', 6: 'Property', 8: 'Constructor',
    9: 'Enum', 11: 'Function', 12: 'Variable', 13: 'Constant',
    14: 'String', 22: 'Struct', 23: 'Event',
};
/** Resolve error-class and class-method tokens to workspace symbols. */
async function resolveSymbols(tokens) {
    const names = extractUniqueNames(tokens);
    if (names.length === 0) {
        return { symbols: [], queriesRun: 0 };
    }
    const queries = names.slice(0, maxQueries);
    const results = await Promise.all(queries.map(querySymbols));
    const seen = new Set();
    const symbols = [];
    for (const batch of results) {
        for (const s of batch) {
            const key = `${s.uri.toString()}:${s.line}`;
            if (!seen.has(key)) {
                seen.add(key);
                symbols.push(s);
            }
        }
    }
    return { symbols, queriesRun: queries.length };
}
function extractUniqueNames(tokens) {
    const names = new Set();
    for (const t of tokens) {
        if (t.type === 'error-class') {
            names.add(t.value);
        }
        if (t.type === 'class-method') {
            const className = t.value.split('.')[0];
            if (className) {
                names.add(className);
            }
        }
    }
    return [...names];
}
async function querySymbols(name) {
    try {
        const raw = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', name);
        if (!raw) {
            return [];
        }
        return raw.slice(0, maxResultsPerQuery).map(s => ({
            name: s.name,
            kind: kindNames[s.kind] ?? 'Symbol',
            uri: s.location.uri,
            line: s.location.range.start.line + 1,
            containerName: s.containerName ?? '',
        }));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=symbol-resolver.js.map