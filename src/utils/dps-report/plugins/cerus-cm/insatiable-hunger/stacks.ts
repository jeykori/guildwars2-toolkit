import type { DpsReportJson } from "../../../../../types";
import { INSATIABLE_APPLICATION_MECHANIC } from "./constants";
import type { InsatiableStackCounts } from "./types";

/** Counts parsed Ins.A mechanic units for each player in each phase. */
export function countInsatiableStacks(
	report: DpsReportJson,
): InsatiableStackCounts[] {
	const applications =
		report.mechanics.find(
			(mechanic) => mechanic.name === INSATIABLE_APPLICATION_MECHANIC,
		)?.mechanicsData ?? [];

	return report.phases.map((phase) => {
		const counts: InsatiableStackCounts = {};
		for (const event of applications) {
			if (event.time < phase.start || event.time > phase.end) continue;
			counts[event.actor] =
				(counts[event.actor] ?? 0) + Math.max(1, event.weight ?? 1);
		}
		return counts;
	});
}
