import { describe, expect, it } from "bun:test";
import combatReplayFixture from "../../../../../../../../playground/public/data/dps-report/cerus.cr.json";
import reportFixture from "../../../../../../../../playground/public/data/dps-report/cerus.json";
import type {
	CombatReplayJson,
	DpsReportJson,
} from "../../../../../../../types/dps-report/elite-insights";
import { mapDpsReport } from "../../../../../mapper";
import { aggregateOrbCollects, CERUS_CM_ORB_DELETIONS_ID } from "../index";
import { trackOrbCollects } from "../orbs";

const report = reportFixture as unknown as DpsReportJson;
const combatReplay = combatReplayFixture as unknown as CombatReplayJson;

const tracked = trackOrbCollects(report, combatReplay);

describe("Insatiable Hunger orb lifecycle", () => {
	it("finds all five casts and all fifteen large orb decorations", () => {
		expect(tracked.casts.map((cast) => cast.orbs.length)).toEqual([
			3, 3, 3, 3, 3,
		]);
		expect(tracked.casts.map((cast) => cast.castTime)).toEqual([
			50320, 96554, 148352, 158714, 225955,
		]);
		expect(tracked.casts.flatMap((cast) => cast.orbs)).toHaveLength(15);
		expect(
			tracked.casts.flatMap((cast) =>
				cast.orbs.map((orb) => orb.accounting.requiredUnits === 3),
			),
		).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
		]);
	});

	it("attributes every confirmed player pickup to its orb", () => {
		expect(
			tracked.casts.map((cast) =>
				cast.orbs.map((orb) =>
					orb.events
						.filter((event) => event.type === "pickup")
						.map((event) => event.player),
				),
			),
		).toEqual([
			[
				["Player 4", "Player 5", "Player 7"],
				["Player 1", "Player 2", "Player 6"],
				["Player 7", "Player 4", "Player 3"],
			],
			[
				["Player 6", "Player 4", "Player 9"],
				["Player 9", "Player 4", "Player 6"],
				[],
			],
			[
				["Player 5", "Player 7", "Player 4"],
				[],
				["Player 5", "Player 7", "Player 8"],
			],
			[
				["Player 4", "Player 6", "Player 3"],
				["Player 8", "Player 5", "Player 10"],
				[],
			],
			[
				["Player 3", "Player 7", "Player 9"],
				["Player 10", "Player 6", "Player 8"],
				["Player 6", "Player 8"],
			],
		]);
	});

	it("keeps a stack on its terminal orb when the mechanic event is delayed", () => {
		const delayedReport = structuredClone(report);
		const terminalPickup = tracked.casts
			.flatMap((cast) => cast.orbs)
			.flatMap((orb) =>
				orb.events
					.filter((event) => event.type === "pickup")
					.map((pickup) => ({ orb, pickup })),
			)
			.find(({ orb, pickup }) => pickup.time === orb.endTime);
		if (!terminalPickup) {
			throw new Error("Fixture is missing a terminal Insatiable application");
		}

		const delayedEvent = delayedReport.mechanics
			.find((mechanic) => mechanic.name === "Ins.A")
			?.mechanicsData.find(
				(event) =>
					event.actor === terminalPickup.pickup.player &&
					event.time === terminalPickup.pickup.time,
			);
		if (!delayedEvent) {
			throw new Error("Fixture is missing the terminal mechanic event");
		}
		delayedEvent.time += 500;

		const result = trackOrbCollects(delayedReport, combatReplay);
		const delayedOrb = result.casts
			.flatMap((cast) => cast.orbs)
			.find((orb) =>
				orb.events.some(
					(event) =>
						event.type === "pickup" &&
						event.player === terminalPickup.pickup.player &&
						event.time === terminalPickup.pickup.time + 500,
				),
			);
		expect(delayedOrb?.events).toContainEqual(
			expect.objectContaining({
				type: "pickup",
				player: terminalPickup.pickup.player,
				time: terminalPickup.pickup.time + 500,
				attribution: "terminal-time",
			}),
		);
	});

	it("conserves ambiguous units without manufacturing a deletion", () => {
		expect(tracked.accounting).toMatchObject({
			requiredUnits: 45,
			collectedUnits: 35,
			missedUnits: 1,
			deletedUnits: 6,
			accountedUnits: 42,
			unresolvedUnits: 3,
			isBalanced: false,
		});
		const unresolved = tracked.casts
			.flatMap((cast) => cast.orbs)
			.filter((orb) => orb.outcome === "unresolved");
		expect(unresolved).toHaveLength(1);
		expect(unresolved[0]?.unresolvedReason).toBe("ambiguous-terminal-contact");
	});

	it("keeps only uniquely attributable terminal duplicate touches", () => {
		expect(
			tracked.casts.flatMap((cast) =>
				cast.orbs
					.filter((orb) => orb.outcome === "deleted")
					.map((orb) => ({
						cast: cast.castTime,
						orb: orb.index,
						player: orb.events.find((event) => event.type === "delete")?.player,
						priorPickupTime: orb.events.find((event) => event.type === "delete")
							?.priorPickupTime,
					})),
			),
		).toEqual([
			{ cast: 96554, orb: 2, player: "Player 6", priorPickupTime: 103073 },
			{ cast: 158714, orb: 2, player: "Player 8", priorPickupTime: 168397 },
		]);

		for (const cast of tracked.casts) {
			for (const orb of cast.orbs) {
				const deletion = orb.events.find((event) => event.type === "delete");
				if (orb.outcome !== "deleted" || !deletion) continue;
				expect(deletion.proof.priorPickupDeltaMs).toBeGreaterThan(0);
				expect(deletion.proof.terminalDeltaMs).toBeGreaterThanOrEqual(0);
				expect(deletion.proof.contactDistance).toBeGreaterThanOrEqual(0);
				const delta = deletion.time - deletion.priorPickupTime;
				expect(delta).toBeGreaterThanOrEqual(0);
				expect(delta).toBeLessThanOrEqual(1_000);
			}
		}
	});

	it("triangulates the final orb as Cerus absorption", () => {
		const finalOrb = tracked.casts.at(-1)?.orbs.at(-1);
		if (!finalOrb) throw new Error("Fixture is missing the final orb");

		expect(finalOrb.outcome).toBe("missed");
		expect(finalOrb.endTime).toBe(237470);
		expect(finalOrb.events).toContainEqual({
			type: "empowered",
			target: "Cerus",
			source: "Emp.A",
			time: 237470,
			assignedUnits: 1,
		});
	});

	it("does not call causal deletion evidence an absorption without Empowered", () => {
		const reportWithoutFinalEmpowered = structuredClone(report);
		const empowered = reportWithoutFinalEmpowered.mechanics.find(
			(mechanic) => mechanic.name === "Emp.A",
		);
		if (!empowered) throw new Error("Fixture is missing Emp.A mechanics");
		empowered.mechanicsData = empowered.mechanicsData.filter(
			(event) => event.time !== 237470,
		);

		const result = trackOrbCollects(reportWithoutFinalEmpowered, combatReplay);
		const finalOrb = result.casts.at(-1)?.orbs.at(-1);
		if (!finalOrb) throw new Error("Fixture is missing the final orb");

		expect(finalOrb.outcome).toBe("unresolved");
		expect(finalOrb.unresolvedReason).toBe("causal-contact-only");
		expect(finalOrb.accounting).toMatchObject({
			deletedUnits: 0,
			unresolvedUnits: 1,
		});
	});

	it("accepts a delayed actor Empowered transition after an orb ends", () => {
		const delayedReport = structuredClone(report);
		const empowered = delayedReport.mechanics.find(
			(mechanic) => mechanic.name === "Emp.A",
		);
		const finalTransition = empowered?.mechanicsData.find(
			(event) => event.time === 237470,
		);
		if (!finalTransition) {
			throw new Error("Fixture is missing Cerus's final Emp.A event");
		}
		finalTransition.time += 500;

		const result = trackOrbCollects(delayedReport, combatReplay);
		const finalOrb = result.casts.at(-1)?.orbs.at(-1);
		if (!finalOrb) throw new Error("Fixture is missing the final orb");

		expect(finalOrb.outcome).toBe("missed");
		expect(finalOrb.events).toContainEqual(
			expect.objectContaining({ time: 237970, assignedUnits: 1 }),
		);
	});

	it("retains only collect-related Emp.A transitions", () => {});

	it("is attached to the mapped Cerus encounter details", () => {
		const mapped = mapDpsReport(report, combatReplay);
		expect(mapped.encounterDetails?.orbCollects?.casts).toHaveLength(5);
		expect(
			mapped.players.find((player) => player.characterName === "Player 6")
				?.phases[0]?.customSummaryMetrics[CERUS_CM_ORB_DELETIONS_ID],
		).toEqual({
			dataType: "scalar",
			value: 1,
			tooltip: ["split-1: 3 unit(s)"],
		});
	});

	it("copies Phase 3 deletion metrics into the equivalent 50%-10% phase", () => {
		const phaseReport = structuredClone(report);
		const phaseFive = report.phases[4];
		const firstPhase = report.phases[0];
		if (!phaseFive || !firstPhase) throw new Error("Fixture is incomplete");
		const phase3 = {
			...phaseFive,
			name: "Phase 3",
			start: 128714,
			end: 247972,
		};
		phaseReport.phases = [firstPhase, phase3, { ...phase3, name: "50%-10%" }];

		const mapped = mapDpsReport(phaseReport, combatReplay);
		const player = mapped.players.find(
			(candidate) => candidate.characterName === "Player 8",
		);
		const phase3Index = mapped.phases.findIndex(
			({ name }) => name === "Phase 3",
		);
		const p50Index = mapped.phases.findIndex(({ name }) => name === "50%-10%");
		const phase3Metric =
			player?.phases[phase3Index]?.customSummaryMetrics[
				CERUS_CM_ORB_DELETIONS_ID
			];

		expect(phase3Metric).toEqual({
			dataType: "scalar",
			value: 1,
			tooltip: ["p3-1_double-collect: 3 unit(s)"],
		});
		expect(
			player?.phases[p50Index]?.customSummaryMetrics[CERUS_CM_ORB_DELETIONS_ID],
		).toEqual(phase3Metric);
	});

	it("aggregates expected collects by selected phase across logs", () => {
		const mapped = mapDpsReport(report, combatReplay);
		const aggregated = aggregateOrbCollects(
			[],
			[
				{ ...mapped, id: "first" },
				{ ...mapped, id: "second" },
			],
			{ selectedPhaseNames: new Set(["Phase 1"]) },
		);
		const details = aggregated.orbCollects?.perLog;

		expect(Object.keys(details ?? {})).toEqual(["first", "second"]);
		for (const log of Object.values(details ?? {})) {
			expect(log.collects.map((collect) => collect.name)).toEqual([
				"p1-1_cerus",
			]);
			expect(log.accounting.requiredUnits).toBe(9);
		}
	});

	it("does not attach decorations to an unrelated future cast", () => {
		const reportWithoutHungerCasts: DpsReportJson = {
			...report,
			targets: report.targets.map((target) => ({
				...target,
				rotation: target.rotation.filter(
					(rotation) => ![71224, 72261].includes(rotation.id),
				),
			})),
		};
		const result = trackOrbCollects(reportWithoutHungerCasts, combatReplay);

		expect(result.casts).toHaveLength(0);
	});

	it("recognizes the five-orb Split 2 cast from Empowered Gluttony", () => {
		const gluttonyTarget = report.targets.find((target) =>
			target.name.includes("Gluttony"),
		);
		if (!gluttonyTarget)
			throw new Error("Fixture is missing a Gluttony target");
		const phaseFour = report.phases[3];
		if (!phaseFour) throw new Error("Fixture is missing Phase 3");

		const splitReport: DpsReportJson = {
			...report,
			phases: [
				...report.phases,
				{
					...phaseFour,
					name: "Split 2",
					start: 250000,
					end: 290000,
				},
			],
			targets: [
				...report.targets,
				{
					...gluttonyTarget,
					name: "Empowered Embodiment of Gluttony 2",
					rotation: [
						...gluttonyTarget.rotation,
						{
							id: 69538,
							skills: [
								{
									castTime: 264479,
									duration: 13716,
									timeGained: 0,
									quickness: 0,
								},
							],
						},
					],
				},
			],
		};

		const splitReplay: CombatReplayJson = {
			...combatReplay,
			decorationRenderings: [
				...combatReplay.decorationRenderings,
				...combatReplay.decorationRenderings
					.filter(
						(decoration) =>
							decoration.metadataSignature === "Cir30rgba(0, 0, 0, 0.5)0",
					)
					.slice(0, 5)
					.map((decoration, index) => ({
						...decoration,
						start: 264558 + index * 761,
						end: 269961 + index * 761,
					})),
			],
		};

		const result = trackOrbCollects(splitReport, splitReplay);
		const splitCast = result.casts.find((cast) => cast.expectedOrbCount === 5);

		expect(splitCast?.orbs).toHaveLength(5);
	});
});
