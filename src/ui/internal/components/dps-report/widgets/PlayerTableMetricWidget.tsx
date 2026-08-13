import type { AggregatedPlayer, PlayerTableMetric } from "../../../../../types";
import { useToolkitComponents } from "../../../../context";

interface PlayerTableMetricWidgetProps {
	metric: PlayerTableMetric;
	aggregatedPlayers: AggregatedPlayer[];
}

export function PlayerTableMetricWidget({
	metric,
	aggregatedPlayers,
}: PlayerTableMetricWidgetProps) {
	const { Card, CardHeader, CardTitle, CardDescription, CardContent } =
		useToolkitComponents();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{metric.name}</CardTitle>
				{metric.description && (
					<CardDescription>{metric.description}</CardDescription>
				)}
			</CardHeader>
			<CardContent>
				<div className="rounded-md border">
					<table className="w-full text-sm text-left">
						<thead className="border-b bg-muted/50 text-muted-foreground font-medium">
							<tr>
								<th className="p-3">Player</th>
								<th className="p-3 text-right">Value</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{aggregatedPlayers.map((player) => {
								const playerVal = player.customMetrics?.[metric.id] ?? 0;
								return (
									<tr
										key={player.account}
										className="hover:bg-muted/40 transition-colors"
									>
										<td className="p-3 font-medium flex items-center gap-2">
											{player.primaryIconUrl && (
												<img
													src={player.primaryIconUrl}
													alt=""
													className="w-5 h-5 rounded"
												/>
											)}
											<span>{player.primaryName}</span>
											<span className="text-xs text-muted-foreground">
												({player.account})
											</span>
										</td>
										<td className="p-3 text-right font-semibold">
											{playerVal.toLocaleString()}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
