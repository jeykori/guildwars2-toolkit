import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	LogSummary,
	MetricValue,
} from "../../../../types";
import { ScalarMetricWidget } from "./widgets/ScalarMetricWidget";
import { TopPlayersMetricWidget } from "./widgets/TopPlayersMetricsWidget";

interface EncounterSummaryWidgetsProps {
	metrics: CustomMetricDefinition[];
	aggregatedSquadMetrics: Record<string, MetricValue>;
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
				{metrics.map((metric) => {
					switch (metric.displayType) {
						case "SCALAR":
							return (
								<ScalarMetricWidget
									key={metric.id}
									metric={metric}
									value={
										aggregatedSquadMetrics[metric.id] ?? {
											dataType: "scalar",
											value: -1, // shouldn't happen
										}
									}
									filteredLogs={filteredLogs}
								/>
							);
						case "TOP_PLAYERS":
							return (
								<TopPlayersMetricWidget
									key={metric.id}
									metric={metric}
									aggregatedPlayers={aggregatedPlayers}
								/>
							);
						default:
							return null;
					}
				})}
			</div>
		</div>
	);
}
