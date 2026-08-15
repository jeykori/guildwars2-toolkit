export type ScalarMetricValue = {
	dataType: "scalar";
	value: number;
};

export type RateMetricValue = {
	dataType: "rate";
	count: number;
	outOf: number;
};

export type MetricValue = ScalarMetricValue | RateMetricValue;

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
	aggregation: "SUM" | "AVG" | "MAX" | "MIN";
	triggerId?: number;
};

export type ScalarMetric = CustomMetricBase & {
	/** Aggregated Squad Metrics */
	displayType: "SCALAR";
	thresholds?: MetricThresholds;
};

export type TopPlayersMetric = CustomMetricBase & {
	/** Aggregated Player Metrics */
	displayType: "TOP_PLAYERS";
	description?: string;
	/** @default 3 */
	limit?: number;
};

export type CustomMetricDefinition = ScalarMetric | TopPlayersMetric;
export type AssembledMetricDefinition = CustomMetricDefinition & {
	triggerId: number;
};
