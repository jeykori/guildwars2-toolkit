import type { CustomMetricDefinition } from "../../../../../../types";
import { CERUS_CM_PHASES } from "../../encounter-context/constants";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../../types";
import { INSATIABLE_APPLICATION_MECHANIC } from "./constants";
import { getCollectOrbs, summarizeOrbCollects, trackOrbCollects } from "./orbs";
import type { OrbCollectDetails } from "./types";

export const countInsatiableStacks = (report: {
	phases: { start: number; end: number }[];
	mechanics: {
		name: string;
		mechanicsData: { actor: string; time: number }[];
	}[];
}) => {
	const events =
		report.mechanics.find(
			(mechanic) => mechanic.name === INSATIABLE_APPLICATION_MECHANIC,
		)?.mechanicsData ?? [];
	return report.phases.map((phase) =>
		Object.fromEntries(
			events
				.filter((event) => event.time >= phase.start && event.time <= phase.end)
				.reduce((counts, event) => {
					counts.set(event.actor, (counts.get(event.actor) ?? 0) + 1);
					return counts;
				}, new Map<string, number>()),
		),
	);
};

export const CERUS_CM_ORB_DELETIONS_ID =
	"25989.cerus-cm.orb-collects.deletions";

export const orbDeletionMetric: CustomMetricDefinition = {
	id: CERUS_CM_ORB_DELETIONS_ID,
	name: "Most Orb Deletes",
	description: "Strictly proven deleted orbs",
	aggregation: "SUM",
	displayType: "TOP_PLAYERS",
	limit: 3,
};

export const parseOrbCollects: CerusSubParser = (
	report,
	combatReplay,
	mapped,
) => {
	if (!combatReplay) return mapped;
	const details = trackOrbCollects(report, combatReplay);
	mapped.encounterDetails ??= {};
	mapped.encounterDetails.orbCollects = details;

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
			const deletedOrbs = collects.reduce(
				(total, collect) =>
					total +
					getCollectOrbs(details.casts, collect.name).filter((orb) => {
						const deletion = orb.events.find(
							(event) =>
								event.type === "delete" &&
								event.player === player.characterName,
						);
						return deletion !== undefined && orb.accounting.deletedUnits > 0;
					}).length,
				0,
			);
			const phase = player.phases[phaseIndex];
			if (!phase || deletedOrbs === 0) continue;
			phase.customSummaryMetrics[CERUS_CM_ORB_DELETIONS_ID] = {
				dataType: "scalar",
				value: deletedOrbs,
				tooltip: collects.flatMap((collect) => {
					const units = getCollectOrbs(details.casts, collect.name).reduce(
						(total, orb) => {
							const deletion = orb.events.find(
								(event) =>
									event.type === "delete" &&
									event.player === player.characterName,
							);
							return deletion ? total + orb.accounting.deletedUnits : total;
						},
						0,
					);
					return units > 0 ? [`${collect.name}: ${units} unit(s)`] : [];
				}),
			};
		}
	}

	return mapped;
};

export const aggregateOrbCollects: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
	{ selectedPhaseNames },
) => {
	const perLog: NonNullable<
		ReturnType<CerusPlugin["aggregateDetails"]>["orbCollects"]
	>["perLog"] = {};

	for (const log of logs) {
		const details = (log.encounterDetails as CerusLogDetails | undefined)
			?.orbCollects;
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
		const casts = details.casts.filter((cast) =>
			collectNames.has(cast.collectName),
		);
		const filtered: OrbCollectDetails = {
			...details,
			collects,
			casts,
			accounting: summarizeOrbCollects(collects, casts),
		};
		perLog[log.id] = filtered;
	}

	return { orbCollects: { perLog } };
};
