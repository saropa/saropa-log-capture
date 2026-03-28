import * as assert from "node:assert";
import { formatLogCountShort } from "../../../modules/viewer/log-count-short-format";

suite("formatLogCountShort", () => {
	test("small integers unchanged", () => {
		assert.strictEqual(formatLogCountShort(0), "0");
		assert.strictEqual(formatLogCountShort(999), "999");
	});

	test("thousands use k suffix", () => {
		assert.strictEqual(formatLogCountShort(1000), "1k");
		assert.strictEqual(formatLogCountShort(1500), "1.5k");
		assert.strictEqual(formatLogCountShort(5000), "5k");
		assert.strictEqual(formatLogCountShort(10000), "10k");
		assert.strictEqual(formatLogCountShort(10500), "10.5k");
		assert.strictEqual(formatLogCountShort(999000), "999k");
	});

	test("millions use M suffix", () => {
		assert.strictEqual(formatLogCountShort(1_000_000), "1M");
		assert.strictEqual(formatLogCountShort(1_200_000), "1.2M");
		assert.strictEqual(formatLogCountShort(10_000_000), "10M");
		assert.strictEqual(formatLogCountShort(10_500_000), "10.5M");
		assert.strictEqual(formatLogCountShort(999_000_000), "999M");
	});

	test("billions use B suffix", () => {
		assert.strictEqual(formatLogCountShort(1_000_000_000), "1B");
		assert.strictEqual(formatLogCountShort(2_500_000_000), "2.5B");
	});

	test("non-finite and negative clamp to 0", () => {
		assert.strictEqual(formatLogCountShort(NaN), "0");
		assert.strictEqual(formatLogCountShort(-3), "0");
	});

	test("boundary values do not round up to next unit", () => {
		assert.strictEqual(formatLogCountShort(999_499), "999k");
		assert.strictEqual(formatLogCountShort(999_500), "999k");
		assert.strictEqual(formatLogCountShort(999_999), "999k");
		assert.strictEqual(formatLogCountShort(999_999_999), "999M");
	});

	test("floors fractional input", () => {
		assert.strictEqual(formatLogCountShort(5.9), "5");
		assert.strictEqual(formatLogCountShort(1500.2), "1.5k");
	});
});
