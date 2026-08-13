import type { mapDpsReport } from "../../utils/dps-report";
import type { CustomMetricDefinition } from "./custom-metrics";
import type { DpsReportJson } from "./elite-insights";

type TMappedReport = ReturnType<typeof mapDpsReport>;

export interface EncounterPlugin {
	/** The boss/encounter IDs this plugin applies to */
	triggerIds: number[];

	/** The dictionary definitions for the metrics this plugin extracts */
	dictionary: CustomMetricDefinition[];

	/** Mutates or returns the mapped report with extracted custom metrics */
	parseLog?: (raw: DpsReportJson, mapped: TMappedReport) => TMappedReport;
}
