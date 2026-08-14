import type { MetricValue } from "./custom-metrics";

export type AggregatedPlayer = {
	account: string;
	/** Most used character name */
	primaryName: string;
	primaryIconUrl?: string;
	/** Unique characters */
	characters: {
		name: string;
		profession: string;
		iconUrl?: string;
	}[];
	/** Unique professions */
	professions: {
		name: string;
		iconUrl?: string;
	}[];
	groups: number[];
	totals: {
		downs: number;
		resses: number;
		resDuration: number;
		mechanics: Record<number, number>;
	};
	averages: {
		targetDps: number;
		cleaveDps: number;
		quickness: number;
		alacrity: number;
		damageTaken: number;
		mechanics: Record<number, number>;
	};
	customMetrics: Record<string, MetricValue>;
};
