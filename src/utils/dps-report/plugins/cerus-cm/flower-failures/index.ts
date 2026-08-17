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
const p3Timings = [
	{ name: "P3-1 (Scg)", time: 54.6 },
	{ name: "P3-2 (Chr)", time: 62.28 },
	{ name: "Fast Port (Chr)", time: 129.52 },
	{ name: "Triangle (Scg)", time: 144.59 },
	{ name: "Crescent", time: 296.76 },
] as const satisfies readonly Timing[];

const sub10Timings = [
	{ name: "Sub-10 (Scg)", time: 5.96 },
	{ name: "Sub-10 (Chr)", time: 35.95 },
] as const satisfies readonly Timing[];

export const CERUS_FLOWERS = [
	...p3Timings.map((t) => t.name),
	...sub10Timings.map((t) => t.name),
];

export type CerusFlowerName = (typeof CERUS_FLOWERS)[number];

const ID = "25989.cerus-cm.flower-failures";

export const flowerFailuresMetric: CustomMetricDefinition = {
	id: ID,
	name: "Most Flower Fails",
	aggregation: "SUM",
	displayType: "TOP_PLAYERS",
	limit: 3,
};

const createZeroMatrix = (): FlowerFailMatrix => ({
	fails: 0,
	initialHit: 0,
	poolTick: 0,
	terroristPuddle: 0,
	deaths: 0,
	flowerBreakdown: CERUS_FLOWERS.reduce(
		(acc, flowerName) => {
			acc[flowerName] = 0;
			return acc;
		},
		{} as Record<string, number>,
	),
});

const mergeFlowerResults = (
	a: FlowerMechanicsResult,
	b: FlowerMechanicsResult,
): FlowerMechanicsResult => {
	const playerAttempts = { ...a.playerAttempts };

	for (const [player, count] of Object.entries(b.playerAttempts)) {
		playerAttempts[player] = (playerAttempts[player] || 0) + count;
	}

	return {
		flowerFails: [...a.flowerFails, ...b.flowerFails],
		terroristPuddles: [...a.terroristPuddles, ...b.terroristPuddles],
		playerAttempts,
	};
};

// Helper for aggregation
const mergeMatrixInto = (
	target: FlowerFailMatrix,
	source: FlowerFailMatrix,
) => {
	target.fails += source.fails;
	target.initialHit += source.initialHit;
	target.poolTick += source.poolTick;
	target.terroristPuddle += source.terroristPuddle;
	target.deaths += source.deaths;

	for (const [flowerName, count] of Object.entries(
		source.flowerBreakdown || {},
	)) {
		target.flowerBreakdown[flowerName] =
			(target.flowerBreakdown[flowerName] || 0) + count;
	}
};

export const parseFlowerFailuresMetric: CerusPlugin["parseLog"] = (
	report,
	combatReplay,
	mapped,
) => {
	const decorations = combatReplay?.decorationRenderings;

	/**
	 * Note: 50-10 here is ACTUAL 50-10
	 * - Phase 3 if there was no enrage phase, 50-10 if there was
	 * - in other words, 50-10 only checks pre-enrage flowers
	 */
	const p50_10Result = check50_10FlowerFailures(report, decorations);
	const sub10Result = checkSub10FlowerFailures(report, decorations);
	const allResults =
		p50_10Result && sub10Result
			? mergeFlowerResults(p50_10Result, sub10Result)
			: p50_10Result;

	const toInject = [
		[PHASE_FULL_FIGHT, allResults],
		[PHASE_3, allResults],
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

			const failMatrix = createZeroMatrix();
			for (const fail of playerFails) {
				failMatrix.fails++; // Track total fails

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

				// Track per-flower breakdown
				const flowerName = fail.flowerName;
				failMatrix.flowerBreakdown[flowerName] =
					(failMatrix.flowerBreakdown[flowerName] || 0) + 1;
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
						mergeMatrixInto(playerMatrix[account], matrix);
					}

					if (logFailures[account]) {
						mergeMatrixInto(logFailures[account], matrix);
					}
				});
			});
		}

		perLog[log.id] = logFailures;
	});

	return { flowerFailures: { playerMatrix, perLog } };
};

/** Checks `50%-10%`, if not fallback to `Phase 3` */
const check50_10FlowerFailures = (
	logData: DpsReportJson,
	combatReplayDecorations?: DecorationRendering[],
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
	combatReplayDecorations?: DecorationRendering[],
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
