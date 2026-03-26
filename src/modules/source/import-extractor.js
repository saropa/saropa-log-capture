"use strict";
/** Import/dependency extractor — parses import statements from source files. */
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
exports.extractImports = extractImports;
const vscode = __importStar(require("vscode"));
const langMap = {
    ts: { language: 'TypeScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    tsx: { language: 'TypeScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    js: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    jsx: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g] },
    mjs: { language: 'JavaScript', patterns: [/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g] },
    dart: { language: 'Dart', patterns: [/import\s+['"]([^'"]+)['"]/g] },
    py: { language: 'Python', patterns: [/^import\s+(\S+)/gm, /^from\s+(\S+)\s+import/gm] },
    go: { language: 'Go', patterns: [/^\s*"([^"]+)"/gm] },
    java: { language: 'Java', patterns: [/^import\s+([\w.]+)/gm] },
    kt: { language: 'Kotlin', patterns: [/^import\s+([\w.]+)/gm] },
    kts: { language: 'Kotlin', patterns: [/^import\s+([\w.]+)/gm] },
    rs: { language: 'Rust', patterns: [/^use\s+([\w:]+)/gm, /^extern\s+crate\s+(\w+)/gm] },
    c: { language: 'C', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    cpp: { language: 'C++', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    h: { language: 'C', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    hpp: { language: 'C++', patterns: [/#include\s+[<"]([^>"]+)[>"]/g] },
    swift: { language: 'Swift', patterns: [/^import\s+(\w+)/gm] },
    cs: { language: 'C#', patterns: [/^using\s+([\w.]+)\s*;/gm] },
};
/** Extract imports from a source file. */
async function extractImports(uri) {
    const ext = uri.fsPath.split('.').pop()?.toLowerCase() ?? '';
    const lang = langMap[ext];
    if (!lang) {
        return { imports: [], language: ext, localCount: 0, packageCount: 0 };
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    const entries = [];
    const seen = new Set();
    for (const pattern of lang.patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        for (const match of text.matchAll(regex)) {
            const module = match[1];
            if (!module || seen.has(module)) {
                continue;
            }
            seen.add(module);
            const line = doc.positionAt(match.index ?? 0).line + 1;
            entries.push({ module, isLocal: isLocalImport(module, ext), line });
        }
    }
    const localCount = entries.filter(e => e.isLocal).length;
    return { imports: entries, language: lang.language, localCount, packageCount: entries.length - localCount };
}
function isLocalImport(module, ext) {
    if (module.startsWith('.') || module.startsWith('/')) {
        return true;
    }
    if (ext === 'dart' && module.startsWith('package:')) {
        return false;
    }
    if (ext === 'dart') {
        return true;
    }
    if (['c', 'cpp', 'h', 'hpp'].includes(ext)) {
        return module.includes('/') || module.includes('\\');
    }
    return false;
}
//# sourceMappingURL=import-extractor.js.map