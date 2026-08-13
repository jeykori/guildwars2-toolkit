import type { GraphMetric, LogSummary } from "../../../../../types";
import { useToolkitComponents } from "../../../../context";

interface GraphMetricWidgetProps {
	metric: GraphMetric;
	filteredLogs: LogSummary[];
}

export function GraphMetricWidget({
	metric,
	filteredLogs,
}: GraphMetricWidgetProps) {
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
				<div className="border border-dashed rounded-lg h-72 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
					<p className="font-medium">Graph Visualization Placeholder</p>
					<p className="text-xs mt-1">
						Ready to map data across {filteredLogs.length} filtered logs
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
