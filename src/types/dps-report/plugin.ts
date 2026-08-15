import type { AggregatedPlayer } from "./aggregate";
import type { CustomMetricDefinition } from "./custom-metrics";
import type { CombatReplayJson, DpsReportJson } from "./elite-insights";
import type { LogData } from "./log";
import type { LogSummary } from "./summary";

type TMappedReport<TBespokeDetails = unknown> = Omit<
	LogData<TBespokeDetails>,
	"id"
>;

export interface EncounterPlugin<TDetails = unknown, TAggregated = unknown> {
	/** The boss/encounter IDs this plugin applies to */
	triggerId: number;

	/** The dictionary definitions for the metrics this plugin extracts */
	dictionary: CustomMetricDefinition[];

	/** Mutates or returns the mapped report with extracted custom metrics */
	parseLog: (
		report: DpsReportJson,
		combatReplay: CombatReplayJson | undefined,
		mapped: TMappedReport<TDetails>,
	) => TMappedReport<TDetails>;

	/** Exposes the bespoke reduction logic for this specific encounter */
	aggregateDetails: (
		players: AggregatedPlayer[],
		logs: LogSummary[],
		context: { selectedPhaseNames: Set<string> },
	) => TAggregated;
}
