import type { LogSummary } from "../../../types";

type SelectableLog = Pick<LogSummary, "id" | "maxHealthPercentBurned">;

export const getVisibleLogs = <T extends SelectableLog>(
	logs: T[],
	maxHpLeft: number,
) => logs.filter((l) => 100 - l.maxHealthPercentBurned <= maxHpLeft);

export const areAllLogsIncluded = (
	logs: SelectableLog[],
	excludedLogIds: Set<string>,
) => logs.length > 0 && logs.every((l) => !excludedLogIds.has(l.id));

export const setLogsInclusion = (
	excludedLogIds: Set<string>,
	ids: string[],
	included: boolean,
) => {
	const next = new Set(excludedLogIds);
	ids.forEach((id) => {
		if (included) next.delete(id);
		else next.add(id);
	});
	return next;
};
