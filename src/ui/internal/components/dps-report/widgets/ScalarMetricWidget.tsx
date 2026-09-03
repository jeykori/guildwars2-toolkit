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
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
	LogSummary,
	MetricValue,
	ScalarMetric,
} from "../../../../../types";
import { evaluateThreshold } from "../../../../../utils/dps-report";

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
	// 1. Safely extract the raw number based on the dataType
	let numericValue = 0;
	let formattedValue = "0";
	let metricTooltipLines: string[] = [];

	if (value?.dataType === "scalar") {
		numericValue = value.value;
		formattedValue = Number.isNaN(numericValue)
			? "-"
			: (Math.round(numericValue * 10) / 10).toLocaleString();
		if (value.tooltip) {
			metricTooltipLines = value.tooltip;
		}
	} else if (value?.dataType === "rate") {
		// Treat rates as percentages (0 to 100) for threshold evaluation
		const percent = value.outOf > 0 ? (value.count / value.outOf) * 100 : 0;
		numericValue = percent;
		formattedValue = `${(Math.round(percent * 10) / 10).toLocaleString()}%`;
	}

	// 2. Evaluate threshold using the extracted numeric value
	const {
		color,
		description,
		tooltip: thresholdTooltip,
	} = evaluateThreshold(numericValue, metric.thresholds, filteredLogs);

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
		<Card className={`h-full border ${bgStyle} ${borderStyle}`} size="sm">
			<CardHeader>
				<CardTitle>{metric.name}</CardTitle>
				{description && (
					<CardDescription className="text-muted-foreground">
						{description}
					</CardDescription>
				)}
			</CardHeader>
			<CardContent>
				<CardDescription className="text-2xl font-bold text-primary-foreground">
					<div>{formattedValue}</div>
					{/* If it's a rate, show the raw counts as a subtitle */}
					{value?.dataType === "rate" && (
						<p className="text-xs text-muted-foreground mt-1">
							{value.count} / {value.outOf} attempts
						</p>
					)}
				</CardDescription>
			</CardContent>
		</Card>
	);

	const hasThresholdTooltip = !!thresholdTooltip;
	const hasMetricTooltip = metricTooltipLines.length > 0;

	if (hasThresholdTooltip || hasMetricTooltip) {
		return (
			<Tooltip>
				<TooltipTrigger className="text-left cursor-help w-full h-full block">
					<div className="h-full w-full">{cardContent}</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="flex flex-col gap-1">
						{hasThresholdTooltip && (
							<span className="font-semibold text-primary">
								{thresholdTooltip}
							</span>
						)}

						{hasThresholdTooltip && hasMetricTooltip && (
							<div className="w-full h-px bg-border my-1" />
						)}

						{metricTooltipLines.map((line) => (
							<span key={line} className="text-sm">
								{line}
							</span>
						))}
					</div>
				</TooltipContent>
			</Tooltip>
		);
	}

	return cardContent;
}
