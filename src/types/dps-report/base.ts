import type { MetricValue } from "./custom-metrics";

export type MechanicSeverityGroup =
	| "critical"
	| "high"
	| "medium"
	| "low"
	| "informational"
	| string;

export type TargetPriority = "MAIN" | "BLOCKING" | "NONBLOCKING";

export type MechanicDictionaryItem = {
	name: string;
	severity: MechanicSeverityGroup;
	description: string;
};

export type LogPhase = {
	type: "encounter" | "instance" | "subphase" | "timeframe";
	name: string;
	start: number;
	end: number;
	/** Key: Target index */
	targetPriorities: Record<number, TargetPriority>;
	/** Key: Custom metric ID */
	customSummaryMetrics: Record<string, MetricValue>;
};

export type TargetDamageStats = {
	damage: number;
	condiDamage: number;
	powerDamage: number;
	breakbarDamage: number;
};

export type PlayerPhaseStats = {
	phaseName: string;
	quickness: number;
	alacrity: number;
	damageTaken: number;
	downs: number;
	resses: number;
	resDuration: number;
	/** Key: Mechanic ID (local for TLogData, global for TReportSummary) */
	mechanics: Record<number, number>;
	/** Key: Target index */
	targets: Record<number, TargetDamageStats>;
	/** Key: Custom metric ID */
	customSummaryMetrics: Record<string, MetricValue>;
};
