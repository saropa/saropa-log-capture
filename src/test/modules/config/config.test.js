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
const config_1 = require("../../../modules/config/config");
suite('Config Module', () => {
    suite('isTrackedFile', () => {
        const defaultTypes = ['.log', '.txt', '.md', '.csv', '.json', '.jsonl', '.html'];
        test('should match .log files', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('session.log', defaultTypes), true);
        });
        test('should match .txt files', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('output.txt', defaultTypes), true);
        });
        test('should match .json files', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('data.json', defaultTypes), true);
        });
        test('should match .jsonl files', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('stream.jsonl', defaultTypes), true);
        });
        test('should reject .meta.json sidecar files', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('session.meta.json', defaultTypes), false);
        });
        test('should reject dotfiles', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('.gitkeep', defaultTypes), false);
            assert.strictEqual((0, config_1.isTrackedFile)('.hidden.log', defaultTypes), false);
        });
        test('should reject untracked extensions', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('image.png', defaultTypes), false);
            assert.strictEqual((0, config_1.isTrackedFile)('archive.zip', defaultTypes), false);
        });
        test('should work with custom file types', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('data.xml', ['.xml']), true);
            assert.strictEqual((0, config_1.isTrackedFile)('data.xml', ['.json']), false);
        });
        test('should work with empty file types array', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('session.log', []), false);
        });
        test('should handle files with multiple dots', () => {
            assert.strictEqual((0, config_1.isTrackedFile)('my.session.log', defaultTypes), true);
        });
    });
    suite('shouldRedactEnvVar', () => {
        test('should match exact name (case-insensitive)', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('SECRET_KEY', ['SECRET_KEY']), true);
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('secret_key', ['SECRET_KEY']), true);
        });
        test('should match wildcard at end', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('AWS_ACCESS_KEY_ID', ['AWS_*']), true);
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('AWS_SECRET', ['AWS_*']), true);
        });
        test('should not match non-matching patterns', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('HOME', ['AWS_*']), false);
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('PATH', ['SECRET']), false);
        });
        test('should match wildcard at start', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('DB_PASSWORD', ['*PASSWORD']), true);
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('MY_PASSWORD', ['*PASSWORD']), true);
        });
        test('should match wildcard in middle', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('DB_SECRET_KEY', ['DB_*_KEY']), true);
        });
        test('should return false for empty patterns', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('SECRET', []), false);
        });
        test('should match if any pattern matches', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('API_KEY', ['SECRET', 'API_*', 'TOKEN']), true);
        });
        test('should handle special regex characters in pattern', () => {
            assert.strictEqual((0, config_1.shouldRedactEnvVar)('KEY.NAME', ['KEY.NAME']), true);
        });
    });
    suite('getFileTypeGlob', () => {
        test('should produce single-extension glob', () => {
            assert.strictEqual((0, config_1.getFileTypeGlob)(['.log']), '*.log');
        });
        test('should produce multi-extension glob with braces', () => {
            assert.strictEqual((0, config_1.getFileTypeGlob)(['.log', '.txt']), '*.{log,txt}');
        });
        test('should strip leading dots from extensions', () => {
            const result = (0, config_1.getFileTypeGlob)(['.log', '.txt', '.md']);
            assert.strictEqual(result, '*.{log,txt,md}');
        });
        test('should handle extensions without leading dot', () => {
            assert.strictEqual((0, config_1.getFileTypeGlob)(['log']), '*.log');
        });
        test('should handle mixed dot/no-dot extensions', () => {
            const result = (0, config_1.getFileTypeGlob)(['.log', 'txt']);
            assert.strictEqual(result, '*.{log,txt}');
        });
    });
});
//# sourceMappingURL=config.test.js.map