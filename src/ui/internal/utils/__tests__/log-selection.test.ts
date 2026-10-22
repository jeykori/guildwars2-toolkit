import { describe, expect, it } from "bun:test";
import { areAllLogsIncluded } from "../log-selection";

const logs = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("areAllLogsIncluded", () => {
	it("is true when no log is excluded", () => {
		expect(areAllLogsIncluded(logs, new Set())).toBe(true);
	});

	it("is false when any log is excluded", () => {
		expect(areAllLogsIncluded(logs, new Set(["b"]))).toBe(false);
	});

	it("ignores excluded logs that are not in the list", () => {
		expect(areAllLogsIncluded(logs, new Set(["z"]))).toBe(true);
	});

	it("is false when there are no logs", () => {
		expect(areAllLogsIncluded([], new Set())).toBe(false);
	});
});
