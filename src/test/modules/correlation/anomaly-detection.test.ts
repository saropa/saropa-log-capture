import * as assert from 'assert';
import {
    extractMemoryMb,
    extractCpuLoad,
    extractHttpStatus,
    extractHttpDuration,
    isMemorySpike,
    isCpuSpike,
    isHttpError,
    isHttpTimeout,
    isTimeoutError,
    isNetworkError,
} from '../../../modules/correlation/anomaly-detection';
import type { TimelineEvent } from '../../../modules/timeline/timeline-event';

/** Build a minimal TimelineEvent with given summary and optional detail. */
function makeEvent(summary: string, detail?: string): TimelineEvent {
    return { timestamp: Date.now(), source: 'debug', level: 'info', summary, detail };
}

suite('AnomalyDetection', () => {

    suite('extractMemoryMb', () => {

        test('should extract MB value from summary text', () => {
            const event = makeEvent('Memory: 450MB');
            assert.strictEqual(extractMemoryMb(event), 450);
        });

        test('should extract MB value with space before unit', () => {
            const event = makeEvent('Memory drop: 120 → 80 MB');
            // Regex matches the last number adjacent to "MB" (80), not the first (120)
            assert.strictEqual(extractMemoryMb(event), 80);
        });

        test('should extract decimal MB value', () => {
            const event = makeEvent('Usage: 123.5 mb remaining');
            assert.strictEqual(extractMemoryMb(event), 123.5);
        });

        test('should extract from detail JSON with freememMb field', () => {
            const event = makeEvent('perf sample', JSON.stringify({ freememMb: 256 }));
            assert.strictEqual(extractMemoryMb(event), 256);
        });

        test('should return undefined when no memory info present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(extractMemoryMb(event), undefined);
        });

        test('should return undefined for malformed detail JSON', () => {
            const event = makeEvent('perf sample', 'not json');
            assert.strictEqual(extractMemoryMb(event), undefined);
        });
    });

    suite('extractCpuLoad', () => {

        test('should extract load from summary text', () => {
            const event = makeEvent('Load: 3.5 high');
            assert.strictEqual(extractCpuLoad(event), 3.5);
        });

        test('should extract loadavg from summary text', () => {
            const event = makeEvent('loadavg: 2.1');
            assert.strictEqual(extractCpuLoad(event), 2.1);
        });

        test('should extract from detail JSON with loadAvg1 field', () => {
            const event = makeEvent('perf sample', JSON.stringify({ loadAvg1: 1.8 }));
            assert.strictEqual(extractCpuLoad(event), 1.8);
        });

        test('should return undefined when no CPU info present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(extractCpuLoad(event), undefined);
        });

        test('should return undefined for malformed detail JSON', () => {
            const event = makeEvent('cpu info', '{bad json}');
            assert.strictEqual(extractCpuLoad(event), undefined);
        });
    });

    suite('extractHttpStatus', () => {

        test('should extract status code from → notation in summary', () => {
            const event = makeEvent('GET /api/users → 500');
            assert.strictEqual(extractHttpStatus(event), 500);
        });

        test('should extract from detail JSON with status field', () => {
            const event = makeEvent('request', JSON.stringify({ status: 404 }));
            assert.strictEqual(extractHttpStatus(event), 404);
        });

        test('should extract from detail JSON with statusCode field', () => {
            const event = makeEvent('request', JSON.stringify({ statusCode: 503 }));
            assert.strictEqual(extractHttpStatus(event), 503);
        });

        test('should return undefined when no status present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(extractHttpStatus(event), undefined);
        });

        test('should return undefined for malformed detail JSON', () => {
            const event = makeEvent('request', 'not json');
            assert.strictEqual(extractHttpStatus(event), undefined);
        });
    });

    suite('extractHttpDuration', () => {

        test('should extract duration (ms) from summary', () => {
            const event = makeEvent('GET /api/users → 200 (350ms)');
            assert.strictEqual(extractHttpDuration(event), 350);
        });

        test('should extract from detail JSON with duration field', () => {
            const event = makeEvent('request', JSON.stringify({ duration: 1200 }));
            assert.strictEqual(extractHttpDuration(event), 1200);
        });

        test('should extract from detail JSON with durationMs field', () => {
            const event = makeEvent('request', JSON.stringify({ durationMs: 800 }));
            assert.strictEqual(extractHttpDuration(event), 800);
        });

        test('should return undefined when no duration present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(extractHttpDuration(event), undefined);
        });
    });

    suite('isMemorySpike', () => {

        test('should return true when memory exceeds 500 MB without baseline', () => {
            const event = makeEvent('Memory: 600 MB');
            assert.strictEqual(isMemorySpike(event), true);
        });

        test('should return false when memory is under 500 MB without baseline', () => {
            const event = makeEvent('Memory: 300 MB');
            assert.strictEqual(isMemorySpike(event), false);
        });

        test('should use baseline for spike detection when provided', () => {
            const baseline = { avgMemory: 200, stdDevMemory: 50, avgCpu: 0.5, stdDevCpu: 0.1 };
            // 350 > 200 + 2*50 = 300 → spike
            const spike = makeEvent('Memory: 350 MB');
            assert.strictEqual(isMemorySpike(spike, baseline), true);
            // 280 < 300 → not a spike
            const normal = makeEvent('Memory: 280 MB');
            assert.strictEqual(isMemorySpike(normal, baseline), false);
        });

        test('should return false when no memory info present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(isMemorySpike(event), false);
        });
    });

    suite('isCpuSpike', () => {

        test('should return true when CPU exceeds 0.8 without baseline', () => {
            const event = makeEvent('Load: 1.5');
            assert.strictEqual(isCpuSpike(event), true);
        });

        test('should return false when CPU is under 0.8 without baseline', () => {
            const event = makeEvent('Load: 0.5');
            assert.strictEqual(isCpuSpike(event), false);
        });

        test('should use baseline for spike detection when provided', () => {
            const baseline = { avgMemory: 200, stdDevMemory: 50, avgCpu: 0.5, stdDevCpu: 0.1 };
            // 0.8 > 0.5 + 2*0.1 = 0.7 → spike
            const spike = makeEvent('Load: 0.8');
            assert.strictEqual(isCpuSpike(spike, baseline), true);
            // 0.6 < 0.7 → not a spike
            const normal = makeEvent('Load: 0.6');
            assert.strictEqual(isCpuSpike(normal, baseline), false);
        });

        test('should return false when no CPU info present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(isCpuSpike(event), false);
        });
    });

    suite('isHttpError', () => {

        test('should return true for 4xx status codes', () => {
            const event = makeEvent('GET /api → 404');
            assert.strictEqual(isHttpError(event), true);
        });

        test('should return true for 5xx status codes', () => {
            const event = makeEvent('POST /api → 500');
            assert.strictEqual(isHttpError(event), true);
        });

        test('should return false for 2xx status codes', () => {
            const event = makeEvent('GET /api → 200');
            assert.strictEqual(isHttpError(event), false);
        });

        test('should return false when no status present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(isHttpError(event), false);
        });
    });

    suite('isHttpTimeout', () => {

        test('should return true for duration > 10000ms', () => {
            const event = makeEvent('GET /slow-endpoint (15000ms)');
            assert.strictEqual(isHttpTimeout(event), true);
        });

        test('should return false for duration <= 10000ms', () => {
            const event = makeEvent('GET /fast-endpoint (500ms)');
            assert.strictEqual(isHttpTimeout(event), false);
        });

        test('should return false when no duration present', () => {
            const event = makeEvent('normal log line');
            assert.strictEqual(isHttpTimeout(event), false);
        });
    });

    suite('isTimeoutError', () => {

        test('should detect "timeout" keyword', () => {
            const event = makeEvent('Connection timeout');
            assert.strictEqual(isTimeoutError(event), true);
        });

        test('should detect "timed out" keyword', () => {
            const event = makeEvent('Request timed out');
            assert.strictEqual(isTimeoutError(event), true);
        });

        test('should detect "etimedout" keyword', () => {
            const event = makeEvent('Error: ETIMEDOUT');
            assert.strictEqual(isTimeoutError(event), true);
        });

        test('should return false for non-timeout lines', () => {
            const event = makeEvent('normal operation completed');
            assert.strictEqual(isTimeoutError(event), false);
        });
    });

    suite('isNetworkError', () => {

        test('should detect "network" keyword', () => {
            const event = makeEvent('Network error occurred');
            assert.strictEqual(isNetworkError(event), true);
        });

        test('should detect "econnrefused" keyword', () => {
            const event = makeEvent('Error: ECONNREFUSED');
            assert.strictEqual(isNetworkError(event), true);
        });

        test('should detect "enotfound" keyword', () => {
            const event = makeEvent('Error: ENOTFOUND hostname');
            assert.strictEqual(isNetworkError(event), true);
        });

        test('should detect "socket" keyword', () => {
            const event = makeEvent('Socket closed unexpectedly');
            assert.strictEqual(isNetworkError(event), true);
        });

        test('should return false for non-network lines', () => {
            const event = makeEvent('normal operation completed');
            assert.strictEqual(isNetworkError(event), false);
        });
    });
});
