import type { DpsReportJson } from "../../../../../types";
import { INSATIABLE_BUFF_ID } from "./constants";
import type { InsatiableStackCounts } from "./types";

/**
 * Counts positive Insatiable stack transitions for each player in each phase.
 *
 * This intentionally uses the buff state timeline rather than the generic
 * mechanic counter. It gives us an independent implementation to compare
 * against the existing Insatiable Application output.
 */
export function countInsatiableStacks(
	report: DpsReportJson,
): InsatiableStackCounts[] {
	return report.phases.map((phase) => {
		const counts: InsatiableStackCounts = {};

		for (const player of report.players) {
			const states = player.buffUptimes?.find(
				(buff) => buff.id === INSATIABLE_BUFF_ID,
			)?.states;

			if (!states?.length) continue;

			// Only states strictly before the phase start establish the baseline.
			// A transition exactly at phase.start belongs to that phase, matching
			// the mapper's inclusive mechanic boundaries.
			let previousStack = 0;
			for (const [time, stack] of states) {
				if (time >= phase.start) break;
				previousStack = stack;
			}

			for (const [time, stack] of states) {
				if (time < phase.start) continue;
				if (time > phase.end) break;

				if (stack > previousStack) {
					counts[player.name] =
						(counts[player.name] ?? 0) + (stack - previousStack);
				}

				previousStack = stack;
			}
		}

		return counts;
	});
}
