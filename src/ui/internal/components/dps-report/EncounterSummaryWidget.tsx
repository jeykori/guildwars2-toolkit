import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
	MetricValue,
} from "../../../../types";
import { MetricWidget } from "./widgets/MetricWidget";

interface EncounterSummaryWidgetsProps {
	metrics: CustomMetricDefinition[];
	aggregatedSquadMetrics: Record<string, MetricValue>;
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
}

export function EncounterSummaryWidgets(props: EncounterSummaryWidgetsProps) {
	if (props.metrics.length === 0) return null;

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
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{props.metrics.map((metric) => (
					<MetricWidget key={metric.id} metric={metric} {...props} />
				))}
			</div>
		</div>
	);
}
