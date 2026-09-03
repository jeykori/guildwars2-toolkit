import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AggregatedPlayer, TopPlayersMetric } from "../../../../../types";

interface TopPlayersMetricWidgetProps {
	metric: TopPlayersMetric;
	aggregatedPlayers: AggregatedPlayer[];
}

export function TopPlayersMetricWidget({
	metric,
	aggregatedPlayers,
}: TopPlayersMetricWidgetProps) {
	// Sort players by their scalar value descending, then take top N
	const topPlayers = [...aggregatedPlayers]
		.map((p) => {
			const val = p.customSummaryMetrics?.[metric.id];
			return {
				...p,
				sortValue: val?.dataType === "scalar" ? val.value : 0,
				tooltip: val?.dataType === "scalar" ? val.tooltip : undefined,
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
					<TooltipProvider>
						<div className="space-y-1">
							{topPlayers.map((p, index) => {
								const rowContent = (
									<div
										className={`flex items-center justify-between rounded hover:bg-muted/50 transition-colors ${
											p.tooltip?.length ? "cursor-help" : ""
										}`}
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
								);

								if (p.tooltip && p.tooltip.length > 0) {
									return (
										<Tooltip key={p.account}>
											<TooltipTrigger className="w-full text-left">
												{rowContent}
											</TooltipTrigger>
											<TooltipContent>
												<div className="flex flex-col">
													{p.tooltip.map((line) => (
														<span key={line}>{line}</span>
													))}
												</div>
											</TooltipContent>
										</Tooltip>
									);
								}

								return <div key={p.account}>{rowContent}</div>;
							})}
						</div>
					</TooltipProvider>
				)}
			</CardContent>
		</Card>
	);
}
