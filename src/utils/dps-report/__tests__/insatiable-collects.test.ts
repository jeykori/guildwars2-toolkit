import { describe, expect, it } from "bun:test";
import combatReplayFixture from "../../../../playground/public/data/dps-report/cerus.cr.json";
import reportFixture from "../../../../playground/public/data/dps-report/cerus.json";
import type {
	CombatReplayJson,
	DpsReportJson,
} from "../../../types/dps-report/elite-insights";
import {
	EXPECTED_COLLECTS,
	getInsatiableMissedTransitions,
	matchExpectedCollects,
	trackInsatiableHungerOrbs,
} from "../plugins/cerus-cm/insatiable-hunger";

const report = reportFixture as DpsReportJson;
const combatReplay = combatReplayFixture as CombatReplayJson;

describe("Insatiable Hunger expected-collect contract", () => {
	it("declares the reviewer-specified phase and split sequence", () => {
		expect(EXPECTED_COLLECTS).toEqual([
			{ name: "p1-1_cerus", phase: "Phase 1", times: [51] },
			{ name: "split-1", phase: "Split 1" },
			{
				name: "p2-1_double-collect",
				phase: "Phase 2",
				times: [34, 44],
			},
			{ name: "p2-2_cerus", phase: "Phase 2", times: [112] },
			{ name: "split-2", phase: "Split 2" },
			{
				name: "p3-1_double-collect",
				phase: "Phase 3",
				times: [24, 30],
			},
			{ name: "p3-2_bad-collect_cerus", phase: "Phase 3", times: [97] },
			{
				name: "p3-3_rage_embodiment",
				phase: "Phase 3",
				times: [114],
			},
			{ name: "p3-4_cerus", phase: "Phase 3", times: [164] },
			{
				name: "p3-5_green-phase_embodiment",
				phase: "Phase 3",
				times: [204],
			},
		]);
	});

	it("recognizes casts by target and skill IDs independent of display names", () => {
		const renamed = structuredClone(report);
		for (const target of renamed.targets) target.name = "localized name";
		const { casts } = matchExpectedCollects(renamed);

		expect(casts.map((cast) => cast.castTime)).toEqual([
			50320, 96554, 148352, 158714, 225955,
		]);
		expect(casts.map((cast) => cast.expectedOrbCount)).toEqual([
			3, 3, 3, 3, 3,
		]);
	});

	it("matches at the inclusive three-second tolerance and rejects outside it", () => {
		const phaseReport = structuredClone(report);
		phaseReport.phases = [
			{ ...report.phases[1]!, start: 10000, end: 80000, name: "Phase 1" },
		];
		const expected = [
			{ name: "boundary", phase: "Phase 1" as const, times: [51] },
		];

		phaseReport.phases[0] = { ...phaseReport.phases[0]!, start: -3680 };
		const accepted = matchExpectedCollects(phaseReport, expected);
		phaseReport.phases[0] = { ...phaseReport.phases[0]!, start: -3681 };
		const rejected = matchExpectedCollects(phaseReport, expected);

		expect(accepted.rawCollects).toHaveLength(1);
		expect(rejected.rawCollects).toHaveLength(0);
	});

	it("groups both Phase 2 casts and discards unmatched phase casts", () => {
		const matched = matchExpectedCollects(report);

		expect(
			matched.rawCollects
				.filter(({ phase }) => phase === "Phase 2")
				.map(({ name }) => name),
		).toEqual(["p2-1_double-collect", "p2-2_cerus"]);
	});

	it("groups every eligible cast inside one split collect", () => {
		const matched = matchExpectedCollects(report);

		const split = matched.rawCollects.find(({ name }) => name === "split-1");
		expect(split).toMatchObject({
			name: "split-1",
			expectedOrbCount: 3,
			searchWindow: [95554, 111276],
		});
	});

	it("filters Malice and Cry of Rage Emp.A applications", () => {
		const withRage = structuredClone(report);
		const empowered = withRage.mechanics.find(
			(mechanic) => mechanic.name === "Emp.A",
		);
		if (!empowered) throw new Error("Fixture has no Emp.A mechanic");
		withRage.mechanics.push({
			...empowered,
			name: "CryRage.H",
			mechanicsData: [
				{ ...empowered.mechanicsData[0]!, time: 247474 },
				{ ...empowered.mechanicsData[0]!, time: 247475 },
			],
		});

		expect(getInsatiableMissedTransitions(withRage)).toEqual([
			{
				target: "Cerus",
				source: "Emp.A",
				time: 237470,
				stackDelta: 1,
			},
		]);
	});

	it("turns an absent expected decoration into unresolved units", () => {
		const replay = structuredClone(combatReplay);
		const decorationIndex = replay.decorationRenderings.findIndex(
			(decoration) =>
				decoration.metadataSignature === "Cir30rgba(0, 0, 0, 0.5)0" &&
				decoration.start >= 49000 &&
				decoration.start <= 65000,
		);
		if (decorationIndex < 0) throw new Error("Fixture has no Phase 1 large orb");
		replay.decorationRenderings.splice(decorationIndex, 1);

		const details = trackInsatiableHungerOrbs(report, replay);
		const collect = details.collects.find(({ name }) => name === "p1-1_cerus");
		if (!collect) throw new Error("Fixture has no Phase 1 collect");

		expect(collect.observedOrbCount).toBe(2);
		expect(collect.missingDecorationUnits).toBe(3);
		expect(
			collect.collectedUnits +
				collect.missedUnits +
				collect.deletedUnits +
				collect.unresolvedUnits,
		).toBe(collect.expectedOrbCount * 3);
	});

	it("skips deletion inference when collections and misses fill the collect", () => {
		const details = trackInsatiableHungerOrbs(report, combatReplay);
		const collect = details.collects.find(({ name }) => name === "p2-2_cerus");
		if (!collect) throw new Error("Fixture has no final Phase 2 collect");

		expect(collect.collectedUnits + collect.missedUnits).toBe(9);
		expect(collect.missedUnits).toBe(1);
		expect(collect.deletedUnits).toBe(0);
		expect(collect.unresolvedUnits).toBe(0);
		expect(collect.orbs.every((orb) => !orb.events.some((event) => event.type === "delete"))).toBe(true);
	});

	it("conserves every expected unit into exactly four outcomes", () => {
		const details = trackInsatiableHungerOrbs(report, combatReplay);
		for (const collect of details.collects) {
			expect(collect.conserved).toBe(true);
			expect(
				collect.collectedUnits +
					collect.missedUnits +
					collect.deletedUnits +
					collect.unresolvedUnits,
			).toBe(collect.expectedOrbCount * 3);
			for (const orb of collect.orbs) {
				expect(
					orb.accounting.collectedUnits +
						orb.accounting.missedUnits +
						orb.accounting.deletedUnits,
				).toBeLessThanOrEqual(3);
			}
		}
	});
});
