import type { LogSummary } from "../../../types";

export const areAllLogsIncluded = (
	logs: Pick<LogSummary, "id">[],
	excludedLogIds: Set<string>,
) => logs.length > 0 && logs.every((l) => !excludedLogIds.has(l.id));
