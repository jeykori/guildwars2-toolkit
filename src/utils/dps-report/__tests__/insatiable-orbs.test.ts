import { describe, expect, it } from "bun:test";
import combatReplayFixture from "../../../../playground/public/data/dps-report/cerus.cr.json";
import reportFixture from "../../../../playground/public/data/dps-report/cerus.json";
import type {
	CombatReplayJson,
	DpsReportJson,
} from "../../../types/dps-report/elite-insights";
import { mapDpsReport } from "../mapper";
import {
	CERUS_CM_HUNGER_DELETIONS_ID,
	trackInsatiableHungerOrbs,
} from "../plugins/cerus-cm/insatiable-hunger";

const report = reportFixture as DpsReportJson;
const combatReplay = combatReplayFixture as CombatReplayJson;

const tracked = trackInsatiableHungerOrbs(report, combatReplay);

describe("Insatiable Hunger orb lifecycle", () => {
	it("finds all five casts and all fifteen large orb decorations", () => {
		expect(tracked.unassignedOrbs).toHaveLength(0);
		expect(tracked.casts.map((cast) => cast.orbs.length)).toEqual([
			3, 3, 3, 3, 3,
		]);
		expect(tracked.casts.map((cast) => cast.castTime)).toEqual([
			50320, 96554, 148352, 158714, 225955,
		]);
		expect(
			tracked.casts.flatMap((cast) =>
				cast.orbs.map((orb) => orb.collectionState),
			),
		).toEqual([
			"thrice",
			"thrice",
			"thrice",
			"thrice",
			"thrice",
			"untouched",
			"thrice",
			"untouched",
			"thrice",
			"thrice",
			"thrice",
			"untouched",
			"thrice",
			"thrice",
			"thrice",
		]);
	});

	it("attributes every confirmed player pickup to its orb", () => {
		expect(
			tracked.casts.map((cast) =>
				cast.orbs.map((orb) =>
					orb.playerPickups.map((pickup) => pickup.player),
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
				orb.playerPickups.map((pickup) => ({ orb, pickup })),
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

		const result = trackInsatiableHungerOrbs(delayedReport, combatReplay);
		const delayedOrb = result.casts
			.flatMap((cast) => cast.orbs)
			.find((orb) => orb.spawnTime === terminalPickup.orb.spawnTime);
		expect(delayedOrb?.playerPickups).toContainEqual(
			expect.objectContaining({
				player: terminalPickup.pickup.player,
				time: terminalPickup.pickup.time + 500,
				attribution: "terminal-time",
			}),
		);
	});

	it("does not manufacture balance from ambiguous deletion candidates", () => {
		expect(tracked.accounting).toMatchObject({
			requiredUnits: 45,
			playerInsatiableUnits: 35,
			actorEmpoweredUnits: 1,
			deletedUnits: 6,
			accountedUnits: 42,
			unresolvedUnits: 3,
			unassignedPlayerStackUnits: 0,
			isBalanced: false,
		});
		const unresolved = tracked.casts
			.flatMap((cast) => cast.orbs)
			.filter((orb) => orb.outcome === "unresolved");
		expect(unresolved).toHaveLength(1);
		expect(unresolved[0]?.unresolvedReason).toBe(
			"ambiguous-terminal-contact",
		);
	});

	it("keeps only uniquely attributable terminal duplicate touches", () => {
		expect(
			tracked.casts.flatMap((cast) =>
				cast.orbs
					.filter((orb) => orb.outcome === "player-deleted")
					.map((orb) => ({
						cast: cast.castTime,
						orb: orb.index,
						player: orb.deletedBy?.player,
						priorPickupTime: orb.deletedBy?.priorPickupTime,
					})),
			),
		).toEqual([
			{ cast: 96554, orb: 2, player: "Player 6", priorPickupTime: 103073 },
			{ cast: 158714, orb: 2, player: "Player 8", priorPickupTime: 168397 },
		]);

		for (const cast of tracked.casts) {
			for (const orb of cast.orbs) {
				if (orb.outcome !== "player-deleted" || !orb.deletedBy) continue;
				expect(orb.deletionEvidence).toMatchObject({
					priorInsatiableConfirmed: true,
					noTargetInsatiableApplication: true,
					noActorEmpoweredTransition: true,
					uniqueTerminalContact: true,
					actorPathClear: true,
				});
				const delta = orb.deletedBy.time - orb.deletedBy.priorPickupTime;
				expect(delta).toBeGreaterThanOrEqual(0);
			expect(delta).toBeLessThanOrEqual(1_000);
			}
		}
	});

	it("triangulates the final orb as Cerus absorption", () => {
		const finalOrb = tracked.casts.at(-1)?.orbs.at(-1);
		if (!finalOrb) throw new Error("Fixture is missing the final orb");

		expect(finalOrb.outcome).toBe("cerus-absorbed");
		expect(finalOrb.absorbedBy).toBe("Cerus");
		expect(finalOrb.endTime).toBe(237470);
		expect(finalOrb.empoweredTransitions).toEqual([
			{
				target: "Cerus",
				source: "Cerus",
				time: 237470,
				stackDelta: 1,
				assignedUnits: 1,
			},
		]);
	});

	it("does not call causal deletion evidence an absorption without Empowered", () => {
		const reportWithoutFinalEmpowered = structuredClone(report);
		const cerus = reportWithoutFinalEmpowered.targets.find(
			(target) => target.name === "Cerus",
		);
		const empowered = cerus?.buffs?.find((buff) => buff.id === 69550);
		if (!empowered?.statesPerSource?.Cerus) {
			throw new Error("Fixture is missing Cerus's final Empowered state");
		}
		empowered.statesPerSource.Cerus = empowered.statesPerSource.Cerus.filter(
			([time]) => time !== 237470,
		);

		const result = trackInsatiableHungerOrbs(
			reportWithoutFinalEmpowered,
			combatReplay,
		);
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
		const cerus = delayedReport.targets.find((target) => target.name === "Cerus");
		const empowered = cerus?.buffs?.find((buff) => buff.id === 69550);
		const states = empowered?.statesPerSource?.Cerus;
		if (!states) throw new Error("Fixture is missing Cerus's Empowered states");
		const finalTransition = states.find(([time]) => time === 237470);
		if (!finalTransition) {
			throw new Error("Fixture is missing Cerus's final Empowered transition");
		}
		finalTransition[0] += 500;

		const result = trackInsatiableHungerOrbs(delayedReport, combatReplay);
		const finalOrb = result.casts.at(-1)?.orbs.at(-1);
		if (!finalOrb) throw new Error("Fixture is missing the final orb");

		expect(finalOrb.outcome).toBe("cerus-absorbed");
		expect(finalOrb.empoweredTransitions).toContainEqual(
			expect.objectContaining({ time: 237970, assignedUnits: 1 }),
		);
	});

	it("retains Empowered transitions received by other encounter actors", () => {
		expect(tracked.empoweredTransitions).toEqual([
			{
				target: "Embodiment of Regret (Permanent)",
				source: "Embodiment of Regret (Permanent)",
				time: 234637,
				stackDelta: 5,
			},
			{
				target: "Cerus",
				source: "Embodiment of Regret (Permanent)",
				time: 236709,
				stackDelta: 1,
			},
			{
				target: "Cerus",
				source: "Embodiment of Regret (Permanent)",
				time: 236710,
				stackDelta: 4,
			},
			{
				target: "Cerus",
				source: "Cerus",
				time: 237470,
				stackDelta: 1,
			},
			{
				target: "Cerus",
				source: "Cerus",
				time: 247475,
				stackDelta: 2,
			},
		]);
	});

	it("is attached to the mapped Cerus encounter details", () => {
		const mapped = mapDpsReport(report, combatReplay);
		expect(mapped.encounterDetails?.insatiableHunger?.casts).toHaveLength(5);
		expect(
			mapped.players
				.find((player) => player.characterName === "Player 6")
				?.phases[0]?.customSummaryMetrics[CERUS_CM_HUNGER_DELETIONS_ID],
		).toEqual({
			dataType: "scalar",
			value: 3,
			tooltip: ["Set 2, orb 3: 3 unit(s)"],
		});
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
		const result = trackInsatiableHungerOrbs(
			reportWithoutHungerCasts,
			combatReplay,
		);

		expect(result.casts).toHaveLength(0);
		expect(result.unassignedOrbs).toHaveLength(15);
	});

	it("recognizes the five-orb Split 2 cast from Empowered Gluttony", () => {
		const gluttonyTarget = report.targets.find((target) =>
			target.name.includes("Gluttony"),
		);
		if (!gluttonyTarget) throw new Error("Fixture is missing a Gluttony target");

		const splitReport: DpsReportJson = {
			...report,
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
							decoration.metadataSignature ===
								"Cir30rgba(0, 0, 0, 0.5)0",
					)
					.slice(0, 5)
					.map((decoration, index) => ({
						...decoration,
						start: 264558 + index * 761,
						end: 269961 + index * 761,
					})),
			],
		};

		const result = trackInsatiableHungerOrbs(splitReport, splitReplay);
		const splitCast = result.casts.find((cast) => cast.skillId === 69538);

		expect(splitCast?.orbs).toHaveLength(5);
		expect(result.unassignedOrbs).toHaveLength(0);
	});
});
