import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
	MetricValue,
} from "../../../../../types";
import { GraphMetricWidget } from "./GraphMetricWidget";
import { PlayerTableMetricWidget } from "./PlayerTableMetricWidget";
import { ScalarMetricWidget } from "./ScalarMetricWidget";

interface MetricWidgetRendererProps {
	metric: CustomMetricDefinition;
	aggregatedSquadMetrics: Record<string, MetricValue>;
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
}

export function MetricWidgetRenderer({
	metric,
	aggregatedSquadMetrics,
	aggregatedPlayers,
	filteredLogs,
}: MetricWidgetRendererProps) {
	switch (metric.displayType) {
		case "SCALAR":
			return (
				<ScalarMetricWidget
					metric={metric}
					value={
						aggregatedSquadMetrics[metric.id] ?? {
							dataType: "scalar",
							value: 0,
						}
					}
					filteredLogs={filteredLogs}
				/>
			);
		// TODO:
		case "PLAYER_TABLE":
			return (
				<PlayerTableMetricWidget
					metric={metric}
					aggregatedPlayers={aggregatedPlayers}
				/>
			);
		// TODO:
		case "GRAPH":
			return <GraphMetricWidget metric={metric} filteredLogs={filteredLogs} />;
		default:
			return null;
	}
}
