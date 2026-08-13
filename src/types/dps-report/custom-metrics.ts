export type ThresholdColor =
	| "green"
	| "yellow"
	| "orange"
	| "red"
	| "blue"
	| "none";

export type ThresholdStep = {
	value: number;
	color: ThresholdColor;
	description: string;
	tooltip: string;
};

export type MetricThresholds = {
	/** How to evaluate the steps (e.g. ">=" means higher is better) */
	operator: ">=" | "<=" | ">" | "<";
	/** The fallback color if the value doesn't meet ANY of the steps */
	defaultColor: ThresholdColor;
	normal?: ThresholdStep[];
	cm?: ThresholdStep[];
	lcm?: ThresholdStep[];
};

type CustomMetricBase = {
	id: string;
	name: string;
	placement: "SUMMARY" | "DETAIL_TAB" | "BOTH";
	isGlobal?: boolean;
	triggerIds?: number[];
};

export type ScalarMetric = CustomMetricBase & {
	displayType: "SCALAR";
	aggregation: "SUM" | "AVG" | "MAX" | "MIN";
	thresholds?: MetricThresholds;
};

export type PlayerTableMetric = CustomMetricBase & {
	displayType: "PLAYER_TABLE";
	description?: string;
	aggregation: "SUM" | "AVG" | "MAX" | "MIN";
};

export type GraphMetric = CustomMetricBase & {
	displayType: "GRAPH";
	description?: string;
	// Graphs visualize data across time/logs, so they don't squash data into a single aggregated number.
	// We omit `aggregation` here because the UI will read directly from the array of logs.
};

export type CustomMetricDefinition =
	| ScalarMetric
	| PlayerTableMetric
	| GraphMetric;
