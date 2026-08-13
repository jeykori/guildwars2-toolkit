import type { LogSummary, MetricThresholds, ThresholdColor } from "../../types";

export function evaluateThreshold(
	val: number,
	thresholds?: MetricThresholds,
	filteredLogs?: LogSummary[],
): { color: ThresholdColor; description?: string; tooltip?: string } {
	if (!thresholds || !filteredLogs || filteredLogs.length === 0) {
		return { color: "none" };
	}

	// Determine highest difficulty present in the current filter
	const hasLCM = filteredLogs.some((l) => l.isLegendaryCM);
	const hasCM = filteredLogs.some((l) => l.isCM && !l.isLegendaryCM);

	// Pick the correct tier's steps
	let steps = thresholds.normal;
	if (hasLCM && thresholds.lcm) steps = thresholds.lcm;
	else if (hasCM && thresholds.cm) steps = thresholds.cm;

	if (!steps || steps.length === 0) {
		return { color: thresholds.defaultColor };
	}

	// Sort steps so we can just grab the first match.
	// If we want ">=", we evaluate the HIGHEST value first.
	// If we want "<=", we evaluate the LOWEST value first.
	const isGreater = thresholds.operator === ">=" || thresholds.operator === ">";
	const sortedSteps = [...steps].sort((a, b) =>
		isGreater ? b.value - a.value : a.value - b.value,
	);

	for (const step of sortedSteps) {
		let isMatch = false;
		if (thresholds.operator === ">=") isMatch = val >= step.value;
		else if (thresholds.operator === "<=") isMatch = val <= step.value;
		else if (thresholds.operator === ">") isMatch = val > step.value;
		else if (thresholds.operator === "<") isMatch = val < step.value;

		if (isMatch) {
			return {
				color: step.color,
				description: step.description,
				tooltip: step.tooltip,
			};
		}
	}

	// Fell through all steps without matching
	return { color: thresholds.defaultColor };
}
