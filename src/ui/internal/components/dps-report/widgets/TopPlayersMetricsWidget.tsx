import type { AggregatedPlayer, TopPlayersMetric } from "../../../../../types";
import { useToolkitComponents } from "../../../../context";

interface TopPlayersMetricWidgetProps {
	metric: TopPlayersMetric;
	aggregatedPlayers: AggregatedPlayer[];
}

export function TopPlayersMetricWidget({
	metric,
	aggregatedPlayers,
}: TopPlayersMetricWidgetProps) {
	const { Card, CardHeader, CardTitle, CardDescription, CardContent } =
		useToolkitComponents();

	// Sort players by their scalar value descending, then take top N
	const topPlayers = [...aggregatedPlayers]
		.map((p) => {
			const val = p.customSummaryMetrics?.[metric.id];
			return {
				...p,
				sortValue: val?.dataType === "scalar" ? val.value : 0,
			};
		})
		.filter((p) => p.sortValue > 0) // Optional: Hide people with 0 fails
		.sort((a, b) => b.sortValue - a.sortValue)
		.slice(0, metric.limit || 3);

	return (
		<Card className="h-full flex flex-col" size="sm">
			<CardHeader>
				<CardTitle>{metric.name}</CardTitle>
				{metric.description && (
					<CardDescription className="text-xs">
						{metric.description}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent>
				{topPlayers.length === 0 ? (
					<div className="text-sm text-muted-foreground">No data recorded.</div>
				) : (
					<div className="space-y-1">
						{topPlayers.map((p, index) => (
							<div
								key={p.account}
								className="flex items-center justify-between"
							>
								<div className="flex items-center gap-2">
									<span className="text-xs font-bold text-muted-foreground w-4">
										#{index + 1}
									</span>
									{p.primaryIconUrl && (
										<img
											src={p.primaryIconUrl}
											alt=""
											className="w-5 h-5 rounded"
										/>
									)}
									<span className="text-sm font-medium truncate max-w-30">
										{p.primaryName}
									</span>
								</div>
								<span className="text-sm font-bold">{p.sortValue}</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
