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
const crashlytics_event_parser_1 = require("../../../modules/crashlytics/crashlytics-event-parser");
suite('CrashlyticsEventParser', () => {
    suite('parseEventResponse', () => {
        test('should return undefined for empty data', () => {
            assert.strictEqual((0, crashlytics_event_parser_1.parseEventResponse)('issue-1', {}), undefined);
        });
        test('should return undefined for empty events array', () => {
            assert.strictEqual((0, crashlytics_event_parser_1.parseEventResponse)('issue-1', { events: [] }), undefined);
        });
        test('should parse structured threads', () => {
            const data = {
                events: [{
                        threads: [
                            {
                                name: 'main',
                                crashed: true,
                                frames: [
                                    { symbol: 'com.app.Main', methodName: 'run', file: 'Main.java', line: 42 },
                                    { symbol: 'com.app.App', methodName: 'start', file: 'App.java', line: 10 },
                                ],
                            },
                            {
                                name: 'worker-1',
                                frames: [
                                    { symbol: 'com.app.Worker', methodName: 'process', file: 'Worker.java', line: 88 },
                                ],
                            },
                        ],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result);
            assert.strictEqual(result.issueId, 'issue-1');
            assert.ok(result.crashThread);
            assert.strictEqual(result.crashThread?.name, 'main');
            assert.strictEqual(result.crashThread?.frames.length, 2);
            assert.strictEqual(result.appThreads.length, 1);
        });
        test('should parse crash thread by name pattern', () => {
            const data = {
                events: [{
                        threads: [{
                                name: 'Fatal Exception: java.lang.NPE',
                                frames: [{ symbol: 'com.app.Foo', file: 'Foo.java', line: 1 }],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result?.crashThread);
            assert.ok(result.crashThread?.name.includes('Fatal'));
        });
        test('should parse raw stack trace', () => {
            const data = {
                stackTrace: '  at com.app.Main.run(Main.java:42)\n  at com.app.App.start(App.java:10)',
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result);
            assert.strictEqual(result.issueId, 'issue-1');
            assert.ok(result.crashThread);
            assert.strictEqual(result.crashThread?.frames.length, 2);
            assert.strictEqual(result.crashThread?.frames[0].fileName, 'Main.java');
            assert.strictEqual(result.crashThread?.frames[0].lineNumber, 42);
        });
        test('should return undefined for short/empty stack trace', () => {
            assert.strictEqual((0, crashlytics_event_parser_1.parseEventResponse)('issue-1', { stackTrace: 'short' }), undefined);
        });
        test('should extract device model from event', () => {
            const data = {
                events: [{
                        device: { model: 'Pixel 6', osVersion: 'Android 13' },
                        threads: [{
                                name: 'main', crashed: true,
                                frames: [{ symbol: 'X', file: 'X.java', line: 1 }],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.strictEqual(result?.deviceModel, 'Pixel 6');
            assert.strictEqual(result?.osVersion, 'Android 13');
        });
        test('should extract event time', () => {
            const data = {
                events: [{
                        eventTime: '2024-01-15T10:00:00Z',
                        threads: [{
                                name: 'main', crashed: true,
                                frames: [{ symbol: 'X', file: 'X.java', line: 1 }],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.strictEqual(result?.eventTime, '2024-01-15T10:00:00Z');
        });
        test('should extract custom keys', () => {
            const data = {
                events: [{
                        customKeys: [
                            { key: 'userId', value: '12345' },
                            { key: 'version', value: '2.0.1' },
                        ],
                        threads: [{
                                name: 'main', crashed: true,
                                frames: [{ symbol: 'X', file: 'X.java', line: 1 }],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result?.customKeys);
            assert.strictEqual(result.customKeys?.length, 2);
            assert.strictEqual(result.customKeys?.[0].key, 'userId');
        });
        test('should extract log entries (breadcrumbs)', () => {
            const data = {
                events: [{
                        logs: [
                            { message: 'User logged in', timestamp: '10:00:00' },
                            { message: 'Button clicked' },
                        ],
                        threads: [{
                                name: 'main', crashed: true,
                                frames: [{ symbol: 'X', file: 'X.java', line: 1 }],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result?.logs);
            assert.strictEqual(result.logs?.length, 2);
            assert.strictEqual(result.logs?.[0].message, 'User logged in');
        });
        test('should handle alternative field names (crashEvents, executionThreads)', () => {
            const data = {
                crashEvents: [{
                        executionThreads: [{
                                threadName: 'main',
                                crashed: true,
                                stackFrames: [
                                    { className: 'com.app.X', methodName: 'run', fileName: 'X.java', lineNumber: 5 },
                                ],
                            }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result);
            assert.ok(result.crashThread);
        });
        test('should skip threads without frames array', () => {
            const data = {
                events: [{
                        threads: [
                            { name: 'main', crashed: true },
                            { name: 'worker', frames: [{ symbol: 'W', file: 'W.java', line: 1 }] },
                        ],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result);
            // main has no frames, so worker becomes the only parsed thread
            assert.strictEqual(result.appThreads.length, 1);
        });
        test('should limit frames per thread', () => {
            const frames = Array.from({ length: 100 }, (_, i) => ({
                symbol: `com.app.Class${i}`,
                file: `File${i}.java`,
                line: i,
            }));
            const data = {
                events: [{
                        threads: [{ name: 'main', crashed: true, frames }],
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result?.crashThread);
            assert.ok(result.crashThread.frames.length <= 50);
        });
        test('should filter out empty custom keys', () => {
            const data = {
                events: [{
                        customKeys: [
                            { key: '', value: 'empty key' },
                            { key: 'valid', value: 'val' },
                        ],
                        stackTrace: '  at com.app.Main.run(Main.java:42)',
                    }],
            };
            const result = (0, crashlytics_event_parser_1.parseEventResponse)('issue-1', data);
            assert.ok(result?.customKeys);
            assert.strictEqual(result.customKeys?.length, 1);
            assert.strictEqual(result.customKeys?.[0].key, 'valid');
        });
    });
});
//# sourceMappingURL=crashlytics-event-parser.test.js.map