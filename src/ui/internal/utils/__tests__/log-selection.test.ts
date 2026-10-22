import { describe, expect, it } from "bun:test";
import {
	areAllLogsIncluded,
	getVisibleLogs,
	setLogsInclusion,
} from "../log-selection";

const log = (id: string, maxHealthPercentBurned = 100) => ({
	id,
	maxHealthPercentBurned,
});

const logs = [log("a"), log("b", 60), log("c", 10)];

describe("getVisibleLogs", () => {
	it("keeps logs whose remaining health is within the slider", () => {
		expect(getVisibleLogs(logs, 100).map((l) => l.id)).toEqual(["a", "b", "c"]);
		expect(getVisibleLogs(logs, 40).map((l) => l.id)).toEqual(["a", "b"]);
		expect(getVisibleLogs(logs, 0).map((l) => l.id)).toEqual(["a"]);
	});
});

describe("areAllLogsIncluded", () => {
	it("is true when no visible log is excluded", () => {
		expect(areAllLogsIncluded(logs, new Set())).toBe(true);
	});

	it("is false when any visible log is excluded", () => {
		expect(areAllLogsIncluded(logs, new Set(["b"]))).toBe(false);
	});

	it("ignores excluded logs that are not visible", () => {
		const visible = getVisibleLogs(logs, 40);
		expect(areAllLogsIncluded(visible, new Set(["c"]))).toBe(true);
	});

	it("is false when there are no logs", () => {
		expect(areAllLogsIncluded([], new Set())).toBe(false);
	});
});

describe("setLogsInclusion", () => {
	it("deselect all excludes every given log", () => {
		const next = setLogsInclusion(new Set(), ["a", "b", "c"], false);
		expect([...next].sort()).toEqual(["a", "b", "c"]);
	});

	it("select all includes every given log", () => {
		const next = setLogsInclusion(new Set(["a", "c"]), ["a", "b", "c"], true);
		expect(next.size).toBe(0);
	});

	it("leaves logs outside the given ids untouched", () => {
		const next = setLogsInclusion(new Set(["c"]), ["a", "b"], true);
		expect([...next]).toEqual(["c"]);

		const hidden = setLogsInclusion(new Set(["c"]), ["a"], false);
		expect([...hidden].sort()).toEqual(["a", "c"]);
	});

	it("does not mutate the previous set", () => {
		const prev = new Set(["a"]);
		setLogsInclusion(prev, ["a", "b"], false);
		expect([...prev]).toEqual(["a"]);
	});

	it("toggles back and forth like the Select All / Deselect All button", () => {
		const visible = getVisibleLogs(logs, 100);
		const ids = visible.map((l) => l.id);
		let excluded = new Set(["b"]);

		// Partially selected → button reads "Select All"
		expect(areAllLogsIncluded(visible, excluded)).toBe(false);
		excluded = setLogsInclusion(excluded, ids, true);
		expect(areAllLogsIncluded(visible, excluded)).toBe(true);

		// All selected → button reads "Deselect All"
		excluded = setLogsInclusion(excluded, ids, false);
		expect(areAllLogsIncluded(visible, excluded)).toBe(false);
		expect(excluded.size).toBe(3);
	});
});
