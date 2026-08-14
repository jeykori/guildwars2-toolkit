import type {
	LogSummary,
	MetricValue,
	ScalarMetric,
} from "../../../../../types";
import { evaluateThreshold } from "../../../../../utils/dps-report";
import { useToolkitComponents } from "../../../../context";

interface ScalarMetricWidgetProps {
	metric: ScalarMetric;
	value?: MetricValue; // Made optional just in case the data is missing
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
		CardContent,
	} = useToolkitComponents();

	// 1. Safely extract the raw number based on the dataType
	let numericValue = 0;
	let formattedValue = "0";

	if (value?.dataType === "scalar") {
		numericValue = value.value;
		formattedValue = (Math.round(numericValue * 10) / 10).toLocaleString();
	} else if (value?.dataType === "rate") {
		// Treat rates as percentages (0 to 100) for threshold evaluation
		const percent = value.outOf > 0 ? (value.count / value.outOf) * 100 : 0;
		numericValue = percent;
		formattedValue = `${(Math.round(percent * 10) / 10).toLocaleString()}%`;
	} else if (value?.dataType === "matrix") {
		formattedValue = "Unsupported Format";
	}

	// 2. Evaluate threshold using the extracted numeric value
	const { color, description, tooltip } = evaluateThreshold(
		numericValue,
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

	const cardContent = (
		<Card
			className={`border h-full flex flex-col justify-between transition-colors ${bgStyle} ${borderStyle}`}
		>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{metric.name}
				</CardTitle>
				{description && (
					<CardDescription className="text-xs font-semibold mt-1">
						{description}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold tracking-tight text-foreground">
					{formattedValue}
				</div>
				{/* If it's a rate, show the raw counts as a subtitle */}
				{value?.dataType === "rate" && (
					<p className="text-xs text-muted-foreground mt-1">
						{value.count} / {value.outOf} attempts
					</p>
				)}
			</CardContent>
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
