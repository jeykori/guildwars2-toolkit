import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
} from "../../../../types";
import { MetricWidgetRenderer } from "./widgets/MetricWidgetRenderer";

interface EncounterSummaryWidgetsProps {
	metrics: CustomMetricDefinition[];
	aggregatedSquadMetrics: Record<string, number>;
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
}

export function EncounterSummaryWidgets({
	metrics,
	aggregatedSquadMetrics,
	aggregatedPlayers,
	filteredLogs,
}: EncounterSummaryWidgetsProps) {
	if (metrics.length === 0) return null;

	return (
		<div className="space-y-4">
			{/* Section Header */}
			<div>
				<h2 className="text-lg font-semibold tracking-tight">
					Encounter Performance
				</h2>
				<p className="text-sm text-muted-foreground">
					Encounter-specific benchmarks and squad checks.
				</p>
			</div>

			{/* Metrics Grid */}
			<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
		</div>
	);
}
