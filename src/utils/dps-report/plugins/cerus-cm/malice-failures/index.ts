import type { CustomMetricDefinition } from "../../../../../types";
import {
	CERUS_CM_PHASES,
	FLOWER_MARKERS,
	FLOWER_PORTAL_IDS,
} from "../encounter-context/constants";
import type { CerusSubParser } from "../types";
import type { MaliceTime } from "./types";
import { checkMaliceFailures } from "./util";

const p1MaliceTimings = [
	{
		name: "P1-1",
		time: 25,
		portalId: FLOWER_PORTAL_IDS.p1[1],
	},
	{
		name: "P1-2",
		time: 51,
		portalId: FLOWER_PORTAL_IDS.p1[2],
	},
] as const satisfies MaliceTime[];

const p2MaliceTimings = [
	{
		name: "P2-1",
		time: 46,
		portalId: FLOWER_PORTAL_IDS.p2[2],
	},
	{
		name: "P2-2-rage",
		time: 60,
		portalId: FLOWER_PORTAL_IDS.p2[3],
	},
	{
		name: "P2-3",
		time: 111,
		portalId: FLOWER_PORTAL_IDS.p2[4],
	},
] as const satisfies MaliceTime[];

const p3MaliceTimings = [
	{
		name: "P3-1-rage",
		time: 45,
		portalId: FLOWER_PORTAL_IDS.p3[2],
	},
	{
		name: "P3-2-flower-circle",
		time: 62,
		dropLocation: { location: FLOWER_MARKERS.circle, radius: 450 },
	},
	{
		name: "P3-3-fast-port",
		time: 129,
		portalId: FLOWER_PORTAL_IDS.p3[7],
	},
	{
		name: "P3-4-extra-malice",
		time: 135,
		failOnTarget: true,
	},
	{
		name: "P3-4-spiral",
		time: 196,
		portalId: FLOWER_PORTAL_IDS.p3[9],
	},
] as const satisfies MaliceTime[];

const sub10MaliceTimings = [
	{
		name: "P4-1",
		time: 37,
		portalId: FLOWER_PORTAL_IDS.p4[2],
	},
] as const satisfies MaliceTime[];

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

	const p1Result = getPhaseResult(CERUS_CM_PHASES.P1, p1MaliceTimings);
	const p2Result = getPhaseResult(CERUS_CM_PHASES.P2, p2MaliceTimings);
	const p3Result = getPhaseResult(CERUS_CM_PHASES.P50_10, p3MaliceTimings)
		.length
		? getPhaseResult(CERUS_CM_PHASES.P50_10, p3MaliceTimings)
		: getPhaseResult(CERUS_CM_PHASES.P3, p3MaliceTimings);
	const sub10Result = getPhaseResult(
		CERUS_CM_PHASES.ENRAGED_SMASH,
		sub10MaliceTimings,
	);

	const fullFightResult = [
		...p1Result,
		...p2Result,
		...p3Result,
		...sub10Result,
	];

	const fullP3Result = [...p3Result, ...sub10Result];

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
			// Count how many times this specific player failed in this phase
			const failCount = maliceFail.filter(
				({ actor }) => actor === player.characterName,
			).length;

			const pPhase = player.phases[phaseIndex];

			if (pPhase && failCount > 0) {
				pPhase.customSummaryMetrics[CERUS_CM_MALICE_FAILS_ID] = {
					dataType: "scalar",
					value: failCount,
				};
			}
		});
	});

	return mapped;
};
