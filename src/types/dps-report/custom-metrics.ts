export type ScalarMetricValue = {
	dataType: "scalar";
	value: number;
};

export type MatrixMetricValue = {
	dataType: "matrix";
	/** e.g., { "Red Flower": 2, "Blue Flower": 1 } */
	values: Record<string, number>;
};

export type RateMetricValue = {
	dataType: "rate";
	count: number;
	outOf: number;
};

export type MetricValue =
	| ScalarMetricValue
	| MatrixMetricValue
	| RateMetricValue;

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
	/**
	 * If provided, the UI expects `player.customMetrics[id]` to be a `Record<string, number>`.
	 * e.g., { "Flower A": 2, "Flower B": 1 }
	 */
	subColumns?: { key: string; label: string }[];
	/** Whether to append a "Total" column at the end of the subColumns */
	showTotal?: boolean;
};

export type GraphMetric = CustomMetricBase & {
	displayType: "GRAPH";
	description?: string;
	/**
	 * "ABSOLUTE": Graphs the raw total per log (e.g., 5 fails).
	 * "RATE": Graphs a percentage per log. Requires the backend to provide data as `{ count: number, outOf: number }`
	 */
	mode: "ABSOLUTE" | "RATE";
};

export type CustomMetricDefinition =
	| ScalarMetric
	| PlayerTableMetric
	| GraphMetric;
