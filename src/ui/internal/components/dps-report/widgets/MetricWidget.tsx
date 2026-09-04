import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
	MetricValue,
} from "../../../../../types";
import { ScalarMetricWidget } from "./ScalarMetricWidget";
import { TopPlayersMetricWidget } from "./TopPlayersMetricsWidget";

export interface MetricWidgetProps {
	metric: CustomMetricDefinition;
	aggregatedSquadMetrics: Record<string, MetricValue>;
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
}

export function MetricWidget({
	metric,
	aggregatedSquadMetrics,
	aggregatedPlayers,
	filteredLogs,
}: MetricWidgetProps) {
	switch (metric.displayType) {
		case "SCALAR":
			return (
				<ScalarMetricWidget
					metric={metric}
					value={
						aggregatedSquadMetrics[metric.id] ?? {
							dataType: "scalar",
							value: NaN,
						}
					}
					filteredLogs={filteredLogs}
				/>
			);
		case "TOP_PLAYERS":
			return (
				<TopPlayersMetricWidget
					metric={metric}
					aggregatedPlayers={aggregatedPlayers}
				/>
			);
		default:
			return null;
	}
}
