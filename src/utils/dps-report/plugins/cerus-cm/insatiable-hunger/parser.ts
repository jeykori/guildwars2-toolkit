import type { CustomMetricDefinition } from "../../../../../types";
import { CERUS_CM_PHASES } from "../encounter-context/constants";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../types";
import {
	summarizeInsatiableCollects,
	trackInsatiableHungerOrbs,
} from "./orbs";
import type { InsatiableHungerDetails } from "./types";

export const CERUS_CM_HUNGER_DELETIONS_ID =
	"25989.cerus-cm.insatiable-hunger.deletions";

export const insatiableHungerDeletionMetric: CustomMetricDefinition = {
	id: CERUS_CM_HUNGER_DELETIONS_ID,
	name: "Most Hunger Deletions",
	description: "Strictly proven deleted orb units",
	aggregation: "SUM",
	displayType: "TOP_PLAYERS",
	limit: 3,
};

export const parseInsatiableHunger: CerusSubParser = (
	report,
	combatReplay,
	mapped,
) => {
	const details = trackInsatiableHungerOrbs(report, combatReplay);
	mapped.encounterDetails ??= {};
	mapped.encounterDetails.insatiableHunger = details;

	const phaseCollects = (phaseName: string) => {
		if (phaseName === CERUS_CM_PHASES.FULL_FIGHT) return details.collects;
		if (phaseName === CERUS_CM_PHASES.P50_10) {
			return details.collects.filter((collect) => collect.phase === "Phase 3");
		}
		return details.collects.filter((collect) => collect.phase === phaseName);
	};

	for (const [phaseIndex, reportPhase] of report.phases.entries()) {
		const collects = phaseCollects(reportPhase.name);
		if (collects.length === 0) continue;
		for (const player of mapped.players) {
			const deletedUnits = collects.reduce(
				(total, collect) =>
					total + (collect.players[player.characterName]?.deletedUnits ?? 0),
				0,
			);
			const phase = player.phases[phaseIndex];
			if (!phase || deletedUnits === 0) continue;
			phase.customSummaryMetrics[CERUS_CM_HUNGER_DELETIONS_ID] = {
				dataType: "scalar",
				value: deletedUnits,
				tooltip: collects.flatMap((collect) => {
					const units = collect.players[player.characterName]?.deletedUnits ?? 0;
					return units > 0 ? [`${collect.name}: ${units} unit(s)`] : [];
				}),
			};
		}
	}

	return mapped;
};

export const aggregateInsatiableHunger: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
	{ selectedPhaseNames },
) => {
	const perLog: NonNullable<
		ReturnType<CerusPlugin["aggregateDetails"]>["insatiableHunger"]
	>["perLog"] = {};

	for (const log of logs) {
		const details = (log.encounterDetails as CerusLogDetails | undefined)
			?.insatiableHunger;
		if (!details) continue;
		const includeAll = selectedPhaseNames.has(CERUS_CM_PHASES.FULL_FIGHT);
		const includeP3 = selectedPhaseNames.has(CERUS_CM_PHASES.P50_10);
		const collects = details.collects.filter(
			(collect) =>
				includeAll ||
				selectedPhaseNames.has(collect.phase) ||
				(includeP3 && collect.phase === CERUS_CM_PHASES.P3),
		);
		const collectNames = new Set(collects.map((collect) => collect.name));
		const filtered: InsatiableHungerDetails = {
			...details,
			collects,
			casts: details.casts.filter((cast) => collectNames.has(cast.collectName)),
			empoweredTransitions: details.empoweredTransitions.filter((transition) =>
				collects.some(
					(collect) =>
						transition.time >= collect.searchWindow[0] &&
						transition.time <= collect.searchWindow[1],
				),
			),
			accounting: summarizeInsatiableCollects(collects),
		};
		perLog[log.id] = filtered;
	}

	return { insatiableHunger: { perLog } };
};
