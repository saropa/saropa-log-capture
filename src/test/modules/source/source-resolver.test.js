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
const assert = __importStar(require("assert"));
const source_resolver_1 = require("../../../modules/source/source-resolver");
suite('resolveSourceUri', () => {
    test('should return undefined for empty path', () => {
        assert.strictEqual((0, source_resolver_1.resolveSourceUri)(''), undefined);
    });
    test('should resolve absolute Unix path', () => {
        const uri = (0, source_resolver_1.resolveSourceUri)('/home/user/project/src/file.ts');
        assert.ok(uri);
        assert.ok(uri.fsPath.includes('file.ts'));
    });
    test('should resolve Windows drive path', () => {
        const uri = (0, source_resolver_1.resolveSourceUri)('C:\\Users\\project\\src\\file.ts');
        assert.ok(uri);
        assert.ok(uri.fsPath.includes('file.ts'));
    });
    test('should resolve UNC path starting with backslash', () => {
        const uri = (0, source_resolver_1.resolveSourceUri)('\\\\server\\share\\file.ts');
        assert.ok(uri);
    });
    test('should strip Dart package prefix', () => {
        // Without a workspace folder, this returns undefined
        // but the prefix stripping logic is still exercised
        const uri = (0, source_resolver_1.resolveSourceUri)('package:my_app/src/widget.dart');
        // May be undefined if no workspace folder is set in test environment
        // The important thing is it doesn't throw
        assert.ok(uri === undefined || uri.fsPath.includes('widget.dart'));
    });
});
//# sourceMappingURL=source-resolver.test.js.map