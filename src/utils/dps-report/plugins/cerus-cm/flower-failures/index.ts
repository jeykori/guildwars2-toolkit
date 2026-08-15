import type {
	CustomMetricDefinition,
	DpsReportJson,
} from "../../../../../types";
import type { DecorationRendering } from "../../../../../types/dps-report/elite-insights/combat-replay-json";
import type { CerusLogDetails, CerusPlugin } from "../types";
import type { FlowerFailMatrix, FlowerMechanicsResult, Timing } from "./types";
import { checkFlowerFailures } from "./util";

const PHASE_FULL_FIGHT = "Full Fight";
const PHASE_3 = "Phase 3";
const PHASE_50_10 = "50%-10%";
const PHASE_ENRAGED_SMASH = "Enraged Smash";

/** Seconds into P3 */
const p3Timings: Timing[] = [
	{ name: "1 (Scg)", time: 54.6 },
	{ name: "2 (Chr)", time: 62.28 },
	{ name: "Fast Port (Chr)", time: 129.52 },
	{ name: "Triangle (Scg)", time: 144.59 },
	{ name: "Crescent", time: 296.76 },
];

const sub10Timings: Timing[] = [
	{ name: "1 (Scg)", time: 5.96 },
	{ name: "2 (Chr)", time: 35.95 },
];

const ID = "25989.cerus-cm.flower-failures";

export const flowerFailuresMetric: CustomMetricDefinition = {
	id: ID,
	name: "Most Flower Fails",
	aggregation: "SUM",
	displayType: "TOP_PLAYERS",
	limit: 3,
};

// HELPER: Merge two FlowerMechanicsResult objects together
const mergeFlowerResults = (
	a: FlowerMechanicsResult | null,
	b: FlowerMechanicsResult | null,
): FlowerMechanicsResult | null => {
	if (!a && !b) return null;

	const merged: FlowerMechanicsResult = {
		flowerFails: [],
		terroristPuddles: [],
		playerAttempts: {},
	};

	if (a) {
		merged.flowerFails.push(...a.flowerFails);
		merged.terroristPuddles.push(...a.terroristPuddles);
		for (const [player, count] of Object.entries(a.playerAttempts)) {
			merged.playerAttempts[player] =
				(merged.playerAttempts[player] || 0) + count;
		}
	}

	if (b) {
		merged.flowerFails.push(...b.flowerFails);
		merged.terroristPuddles.push(...b.terroristPuddles);
		for (const [player, count] of Object.entries(b.playerAttempts)) {
			merged.playerAttempts[player] =
				(merged.playerAttempts[player] || 0) + count;
		}
	}

	return merged;
};

export const parseFlowerFailuresMetric: CerusPlugin["parseLog"] = (
	report,
	combatReplay,
	mapped,
) => {
	const decorations = combatReplay.decorationRenderings;

	const p50_10Result = check50_10FlowerFailures(report, decorations);
	const sub10Result = checkSub10FlowerFailures(report, decorations);
	const p3Result = mergeFlowerResults(p50_10Result, sub10Result);

	const toInject = [
		[PHASE_FULL_FIGHT, p3Result],
		[PHASE_3, p3Result],
		[PHASE_50_10, p50_10Result],
		[PHASE_ENRAGED_SMASH, sub10Result],
	] as const;

	// 1. Build a local dictionary to satisfy TypeScript
	const flowerFailures: Record<string, Record<string, FlowerFailMatrix>> = {};

	toInject.forEach(([phaseName, result]) => {
		const phaseIndex = report.phases.findIndex((p) => p.name === phaseName);
		if (phaseIndex === -1 || !result) return;

		// 1. Create a local map for just this phase
		const phaseFailures: Record<string, FlowerFailMatrix> = {};

		mapped.players.forEach((player) => {
			const playerFails = result.flowerFails.filter(
				(f) => f.actor === player.characterName,
			);

			const failMatrix: FlowerFailMatrix = {
				fails: playerFails.length,
				initialHit: 0,
				poolTick: 0,
				terroristPuddle: 0,
				deaths: 0,
			};

			for (const fail of playerFails) {
				// Map the string literal reason to the correct camelCase property
				switch (fail.reason) {
					case "Initial Hit":
						failMatrix.initialHit++;
						break;
					case "Pool Tick":
						failMatrix.poolTick++;
						break;
					case "Terrorist Puddle":
						failMatrix.terroristPuddle++;
						break;
				}

				if (fail.severity === "Failed") {
					failMatrix.deaths++;
				}
			}
			phaseFailures[player.account] = failMatrix;

			const pPhase = player.phases[phaseIndex];
			if (pPhase) {
				pPhase.customSummaryMetrics[ID] = {
					dataType: "scalar",
					value: playerFails.length,
				};
			}
		});
		flowerFailures[phaseName] = phaseFailures;
	});

	// 2. Safely merge it into the root encounter details
	mapped.encounterDetails = mapped.encounterDetails || {};
	const details = mapped.encounterDetails as CerusLogDetails;

	details.flowerFailures = flowerFailures;

	return mapped;
};

export const aggregateFlowerFailures: CerusPlugin["aggregateDetails"] = (
	players,
	logs,
	{ selectedPhaseNames },
) => {
	const playerMatrix: Record<string, FlowerFailMatrix> = {};
	const perLog: Record<string, Record<string, FlowerFailMatrix>> = {};

	const createZeroMatrix = (): FlowerFailMatrix => ({
		fails: 0,
		initialHit: 0,
		poolTick: 0,
		terroristPuddle: 0,
		deaths: 0,
	});

	players.forEach((p) => {
		playerMatrix[p.account] = createZeroMatrix();
	});

	logs.forEach((log) => {
		const logFailures: Record<string, FlowerFailMatrix> = {};
		players.forEach((p) => {
			logFailures[p.account] = createZeroMatrix();
		});

		const details = log.encounterDetails as CerusLogDetails | undefined;
		if (details?.flowerFailures) {
			selectedPhaseNames.forEach((phase) => {
				const phaseData = details.flowerFailures?.[phase];
				if (!phaseData) return;

				Object.entries(phaseData).forEach(([account, matrix]) => {
					if (playerMatrix[account]) {
						playerMatrix[account].fails += matrix.fails;
						playerMatrix[account].initialHit += matrix.initialHit;
						playerMatrix[account].poolTick += matrix.poolTick;
						playerMatrix[account].terroristPuddle += matrix.terroristPuddle;
						playerMatrix[account].deaths += matrix.deaths;
					}

					if (logFailures[account]) {
						logFailures[account].fails += matrix.fails;
						logFailures[account].initialHit += matrix.initialHit;
						logFailures[account].poolTick += matrix.poolTick;
						logFailures[account].terroristPuddle += matrix.terroristPuddle;
						logFailures[account].deaths += matrix.deaths;
					}
				});
			});
		}

		perLog[log.id] = logFailures;
	});

	return { flowerFailures: { playerMatrix, perLog } };
};

const check50_10FlowerFailures = (
	logData: DpsReportJson,
	combatReplayDecorations: DecorationRendering[],
) => {
	const p3Start =
		logData.phases.find((p) => p.name === PHASE_50_10)?.start ??
		logData.phases.find((p) => p.name === PHASE_3)?.start;

	if (!p3Start) return null;

	return checkFlowerFailures(
		p3Start,
		p3Timings,
		logData,
		combatReplayDecorations,
	);
};

const checkSub10FlowerFailures = (
	logData: DpsReportJson,
	combatReplayDecorations: DecorationRendering[],
) => {
	const p3Start = logData.phases.find(
		(p) => p.name === PHASE_ENRAGED_SMASH,
	)?.start;

	if (!p3Start) return null;

	return checkFlowerFailures(
		p3Start,
		sub10Timings,
		logData,
		combatReplayDecorations,
	);
};
