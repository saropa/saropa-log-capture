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
const security_audit_1 = require("../../../modules/integrations/providers/security-audit");
suite('security-audit', () => {
    suite('redact', () => {
        test('should redact TargetUserName', () => {
            const input = 'TargetUserName: JohnDoe';
            assert.strictEqual((0, security_audit_1.redact)(input), 'TargetUserName=REDACTED');
        });
        test('should redact Account Name', () => {
            const input = 'Account Name: DOMAIN\\admin';
            assert.strictEqual((0, security_audit_1.redact)(input), 'TargetUserName=REDACTED');
        });
        test('should redact SubjectUserName', () => {
            const input = 'SubjectUserName=system_user';
            assert.strictEqual((0, security_audit_1.redact)(input), 'TargetUserName=REDACTED');
        });
        test('should redact IpAddress', () => {
            const input = 'IpAddress: 192.168.1.100';
            assert.strictEqual((0, security_audit_1.redact)(input), 'IpAddress=REDACTED');
        });
        test('should redact multiple fields in one message', () => {
            const input = 'TargetUserName: admin, IpAddress: 10.0.0.1';
            const result = (0, security_audit_1.redact)(input);
            assert.ok(result.includes('TargetUserName=REDACTED'));
            assert.ok(result.includes('IpAddress=REDACTED'));
            assert.ok(!result.includes('admin'));
            assert.ok(!result.includes('10.0.0.1'));
        });
        test('should pass through clean strings unchanged', () => {
            const input = 'Process exited with code 0';
            assert.strictEqual((0, security_audit_1.redact)(input), 'Process exited with code 0');
        });
        test('should handle empty string', () => {
            assert.strictEqual((0, security_audit_1.redact)(''), '');
        });
    });
    suite('buildEventSummary', () => {
        test('should categorize logon events', () => {
            const events = [
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 4625, level: '', message: '' },
            ];
            const summary = (0, security_audit_1.buildEventSummary)(events);
            assert.ok(summary.includes('2 logon'));
            assert.ok(summary.includes('1 failed logon'));
        });
        test('should categorize logoff events', () => {
            const events = [
                { time: '', id: 4634, level: '', message: '' },
                { time: '', id: 4647, level: '', message: '' },
            ];
            const summary = (0, security_audit_1.buildEventSummary)(events);
            assert.ok(summary.includes('2 logoff'));
        });
        test('should label unknown event IDs as other', () => {
            const events = [
                { time: '', id: 9999, level: '', message: '' },
            ];
            const summary = (0, security_audit_1.buildEventSummary)(events);
            assert.ok(summary.includes('1 other'));
        });
        test('should handle empty events', () => {
            const summary = (0, security_audit_1.buildEventSummary)([]);
            assert.strictEqual(summary, '0 event(s)');
        });
        test('should handle mix of known and unknown IDs', () => {
            const events = [
                { time: '', id: 4624, level: '', message: '' },
                { time: '', id: 1234, level: '', message: '' },
                { time: '', id: 4688, level: '', message: '' },
            ];
            const summary = (0, security_audit_1.buildEventSummary)(events);
            assert.ok(summary.includes('1 logon'));
            assert.ok(summary.includes('1 other'));
            assert.ok(summary.includes('1 process created'));
        });
    });
});
//# sourceMappingURL=security-audit.test.js.map