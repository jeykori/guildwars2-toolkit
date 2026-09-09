import { describe, expect, it } from "bun:test";
import fixture from "../../../../../../../../playground/public/data/dps-report/cerus.json";
import type { DpsReportJson } from "../../../../../../../types";
import { mapDpsReport } from "../../../../../mapper";
import { countInsatiableStacks } from "../index";

const report = fixture as unknown as DpsReportJson;

function getMechanicCounts(mapped: ReturnType<typeof mapDpsReport>) {
	const mechanicIndex = mapped.mechanicsDictionary.findIndex(
		(mechanic) => mechanic.name === "Insatiable Application",
	);

	expect(mechanicIndex).toBeGreaterThanOrEqual(0);

	return mapped.phases.map((_, phaseIndex) =>
		Object.fromEntries(
			mapped.players
				.map((player) => [
					player.characterName,
					player.phases[phaseIndex]?.mechanics[mechanicIndex] ?? 0,
				])
				.filter(
					(entry): entry is [string, number] =>
						typeof entry[1] === "number" && entry[1] > 0,
				),
		),
	);
}

describe("Insatiable stack attribution", () => {
	it("matches the existing Insatiable Application mechanic counts", () => {
		const mapped = mapDpsReport(report, null);

		expect(countInsatiableStacks(report)).toEqual(getMechanicCounts(mapped));
	});

	it("matches the known Phase 1 and Split 1 fixture attribution", () => {
		const counts = countInsatiableStacks(report);

		expect(counts[1]).toEqual({
			"Player 4": 2,
			"Player 5": 1,
			"Player 7": 2,
			"Player 1": 1,
			"Player 2": 1,
			"Player 3": 1,
			"Player 6": 1,
		});

		expect(counts[3]).toEqual({
			"Player 6": 2,
			"Player 4": 2,
			"Player 9": 2,
		});
	});

	it("counts a positive transition at a phase boundary", () => {
		const firstPhase = report.phases[0];
		const insatiable = report.mechanics.find(
			(mechanic) => mechanic.name === "Ins.A",
		);
		if (!firstPhase || !insatiable?.mechanicsData[0])
			throw new Error("Fixture is incomplete");

		const boundaryReport: DpsReportJson = {
			...report,
			mechanics: [
				{
					...insatiable,
					mechanicsData: [
						{
							...insatiable.mechanicsData[0],
							actor: "Boundary Player",
							time: 1000,
							weight: 1,
						},
					],
				},
			],
			phases: [
				{
					...firstPhase,
					start: 1000,
					end: 2000,
				},
			],
		};

		expect(countInsatiableStacks(boundaryReport)).toEqual([
			{ "Boundary Player": 1 },
		]);
	});
});
