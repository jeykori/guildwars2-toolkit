import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
	MetricValue,
} from "../../../../types";
import { MetricWidgetRenderer } from "./widgets/MetricWidgetRenderer";

interface EncounterDetailsViewProps {
	metrics: CustomMetricDefinition[];
	aggregatedSquadMetrics: Record<string, MetricValue>;
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
}

export function EncounterDetailsView({
	metrics,
	aggregatedSquadMetrics,
	aggregatedPlayers,
	filteredLogs,
}: EncounterDetailsViewProps) {
	if (metrics.length === 0) return null;

	return (
		<div className="space-y-6">
			{metrics.map((metric) => (
				<MetricWidgetRenderer
					key={metric.id}
					metric={metric}
					aggregatedSquadMetrics={aggregatedSquadMetrics}
					aggregatedPlayers={aggregatedPlayers}
					filteredLogs={filteredLogs}
				/>
			))}
		</div>
	);
}
