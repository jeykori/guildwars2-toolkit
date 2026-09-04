import type { CustomMetricDefinition } from "../../../../../../types";
import { CERUS_CM_PHASES } from "../../encounter-context/constants";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../../types";
import { MALICE_TIMINGS } from "./constants";
import type {
	MaliceFails,
	MaliceMetrics,
	MaliceName,
	MaliceTime,
} from "./types";
import { checkMaliceFailures } from "./util";

export const CERUS_CM_MALICE_FAILS_ID = "25989.cerus-cm.malice-failures";
export const maliceFailuresMetric: CustomMetricDefinition = {
	id: CERUS_CM_MALICE_FAILS_ID,
	name: "Most Malice Fails",
	description: "Incorrect drop or extra Malice",
	aggregation: "SUM",
	displayType: "TOP_PLAYERS",
	limit: 3,
};

export const parseMaliceFailuresMetric: CerusSubParser = (
	report,
	_combatReplay,
	mapped,
	encounterContext,
) => {
	const getPhaseResult = (
		phaseName: string,
		timings: readonly MaliceTime[],
	) => {
		const phaseStart = report.phases.find((p) => p.name === phaseName)?.start;
		if (phaseStart === undefined) return [];
		return checkMaliceFailures(phaseStart, timings, encounterContext, report);
	};

	const p1Result = getPhaseResult(CERUS_CM_PHASES.P1, MALICE_TIMINGS.p1);
	const p2Result = getPhaseResult(CERUS_CM_PHASES.P2, MALICE_TIMINGS.p2);
	const has50_10Phase = report.phases.some(
		(p) => p.name === CERUS_CM_PHASES.P50_10,
	);
	const p3Result = has50_10Phase
		? getPhaseResult(CERUS_CM_PHASES.P50_10, MALICE_TIMINGS.p3)
		: getPhaseResult(CERUS_CM_PHASES.P3, MALICE_TIMINGS.p3);

	const sub10Result = getPhaseResult(
		CERUS_CM_PHASES.ENRAGED_SMASH,
		MALICE_TIMINGS.sub10,
	);

	const fullFightResult = [
		...p1Result,
		...p2Result,
		...p3Result,
		...sub10Result,
	];

	const fullP3Result = [...p3Result, ...sub10Result];

	// 1. Inject phase-level summary metrics
	const toInject = [
		[CERUS_CM_PHASES.FULL_FIGHT, fullFightResult],
		[CERUS_CM_PHASES.P1, p1Result],
		[CERUS_CM_PHASES.P2, p2Result],
		[CERUS_CM_PHASES.P3, fullP3Result],
		[CERUS_CM_PHASES.P50_10, p3Result],
		[CERUS_CM_PHASES.ENRAGED_SMASH, sub10Result],
	] as const;

	toInject.forEach(([phaseName, maliceFail]) => {
		const phaseIndex = report.phases.findIndex((p) => p.name === phaseName);
		if (phaseIndex === -1 || !maliceFail.length) return;

		mapped.players.forEach((player) => {
			const playerFail = maliceFail.filter(
				({ actor }) => actor === player.characterName,
			);

			const pPhase = player.phases[phaseIndex];

			if (pPhase && playerFail.length > 0) {
				pPhase.customSummaryMetrics[CERUS_CM_MALICE_FAILS_ID] = {
					dataType: "scalar",
					value: playerFail.length,
					tooltip: playerFail.map(({ maliceName }) => maliceName),
				};
			}
		});
	});

	// 2. Build full log encounter details for tooltips/custom tables
	mapped.encounterDetails ??= {};
	const maliceFails: MaliceFails = {};

	mapped.players.forEach((player) => {
		const playerFails = fullFightResult.filter(
			(f) => f.actor === player.characterName,
		);

		if (playerFails.length > 0) {
			const metrics: MaliceMetrics = {
				totalFails: playerFails.length,
				breakdown: {},
			};

			for (const fail of playerFails) {
				const maliceName = fail.maliceName as MaliceName;

				let stat = metrics.breakdown[maliceName];
				if (!stat) {
					stat = { fails: 0, players: [] };
					metrics.breakdown[maliceName] = stat;
				}

				stat.fails += 1;
				stat.players.push(player.characterName);
			}

			maliceFails[player.account] = metrics;
		}
	});

	mapped.encounterDetails.maliceFails = maliceFails;

	return mapped;
};

export const aggregateMaliceFailures: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
) => {
	const combinedFails: MaliceFails = {};

	for (const log of logs) {
		const logFails = (log.encounterDetails as CerusLogDetails)?.maliceFails;
		if (!logFails) continue;

		for (const [account, metrics] of Object.entries(logFails)) {
			let target = combinedFails[account];

			if (!target) {
				target = {
					totalFails: 0,
					breakdown: {},
				};
				combinedFails[account] = target;
			}

			target.totalFails += metrics.totalFails;

			// Deep merge the specific malice timings
			for (const [maliceId, stat] of Object.entries(metrics.breakdown)) {
				const maliceName = maliceId as MaliceName;

				let targetStat = target.breakdown[maliceName];
				if (!targetStat) {
					targetStat = { fails: 0, players: [] };
					target.breakdown[maliceName] = targetStat;
				}

				targetStat.fails += stat.fails;
				// Merge the character names arrays together across logs
				targetStat.players.push(...stat.players);
			}
		}
	}

	return { maliceFails: combinedFails };
};
