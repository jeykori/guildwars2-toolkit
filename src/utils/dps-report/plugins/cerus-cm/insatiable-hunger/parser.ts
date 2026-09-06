import type { CustomMetricDefinition } from "../../../../../types";
import { CERUS_CM_PHASES } from "../encounter-context/constants";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../types";
import { trackInsatiableHungerOrbs } from "./orbs";

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

	const fullFightIndex = report.phases.findIndex(
		(phase) => phase.name === CERUS_CM_PHASES.FULL_FIGHT,
	);
	if (fullFightIndex >= 0) {
		const orbs = [
			...details.casts.flatMap((cast) =>
				cast.orbs.map((orb) => ({ cast, orb })),
			),
			...details.unassignedOrbs.map((orb) => ({ cast: null, orb })),
		];

		for (const player of mapped.players) {
			const deletions = orbs.filter(
				({ orb }) => orb.deletedBy?.player === player.characterName,
			);
			const deletedUnits = deletions.reduce(
				(total, { orb }) => total + orb.accounting.deletedUnits,
				0,
			);
			const phase = player.phases[fullFightIndex];
			if (!phase || deletedUnits === 0) continue;

			phase.customSummaryMetrics[CERUS_CM_HUNGER_DELETIONS_ID] = {
				dataType: "scalar",
				value: deletedUnits,
				tooltip: deletions.map(({ cast, orb }) =>
					cast
						? `Set ${cast.index + 1}, orb ${orb.index + 1}: ${orb.accounting.deletedUnits} unit(s)`
						: `Unassigned orb ${orb.index + 1}: ${orb.accounting.deletedUnits} unit(s)`,
				),
			};
		}
	}

	return mapped;
};

export const aggregateInsatiableHunger: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
) => {
	const perLog: NonNullable<
		ReturnType<CerusPlugin["aggregateDetails"]>["insatiableHunger"]
	>["perLog"] = {};

	for (const log of logs) {
		const details = (log.encounterDetails as CerusLogDetails | undefined)
			?.insatiableHunger;
		if (details) perLog[log.id] = details;
	}

	return { insatiableHunger: { perLog } };
};
