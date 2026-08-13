import type { LogSummary, ScalarMetric } from "../../../../../types";
import { evaluateThreshold } from "../../../../../utils/dps-report";
import { useToolkitComponents } from "../../../../context";

interface ScalarMetricWidgetProps {
	metric: ScalarMetric;
	value: number;
	filteredLogs: LogSummary[];
}

export function ScalarMetricWidget({
	metric,
	value,
	filteredLogs,
}: ScalarMetricWidgetProps) {
	const {
		Tooltip,
		TooltipTrigger,
		TooltipContent,
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
	} = useToolkitComponents();

	const { color, description, tooltip } = evaluateThreshold(
		value,
		metric.thresholds,
		filteredLogs,
	);

	let bgStyle = "bg-card";
	let borderStyle = "border-border";

	switch (color) {
		case "green":
			bgStyle = "bg-emerald-500/10 dark:bg-emerald-500/20";
			borderStyle = "border-emerald-500/40";
			break;
		case "yellow":
			bgStyle = "bg-amber-500/10 dark:bg-amber-500/20";
			borderStyle = "border-amber-500/40";
			break;
		case "orange":
			bgStyle = "bg-orange-500/10 dark:bg-orange-500/20";
			borderStyle = "border-orange-500/40";
			break;
		case "red":
			bgStyle = "bg-destructive/10";
			borderStyle = "border-destructive/40";
			break;
		case "blue":
			bgStyle = "bg-sky-500/10 dark:bg-sky-500/20";
			borderStyle = "border-sky-500/40";
			break;
	}

	const formattedValue =
		typeof value === "number"
			? (Math.round(value * 10) / 10).toLocaleString()
			: value;

	const cardContent = (
		<Card className={`border ${bgStyle} ${borderStyle}`}>
			<CardHeader>
				<CardTitle>{metric.name}</CardTitle>
				{description && (
					<CardDescription className="text-muted-foreground">
						{description}
					</CardDescription>
				)}
				<CardDescription className="text-2xl font-bold text-primary-foreground">
					{formattedValue}
				</CardDescription>
			</CardHeader>
		</Card>
	);

	if (tooltip) {
		return (
			<Tooltip>
				<TooltipTrigger className="text-left cursor-help w-full">
					<div>{cardContent}</div>
				</TooltipTrigger>
				<TooltipContent>{tooltip}</TooltipContent>
			</Tooltip>
		);
	}

	return cardContent;
}
