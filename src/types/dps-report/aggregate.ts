import type { ENCOUNTER_PLUGINS } from "../../utils/dps-report/plugins";
import type { MetricValue } from "./custom-metrics";

export type PluginsMap = typeof ENCOUNTER_PLUGINS;

export type SpecificEncounterState<K extends keyof PluginsMap> = {
	triggerId: K;
	activePlugin: PluginsMap[K];
	bespokeDetails: ReturnType<PluginsMap[K]["aggregateDetails"]>;
};

export type EncounterDetailStates =
	| { [K in keyof PluginsMap]: SpecificEncounterState<K> }[keyof PluginsMap]
	| { triggerId: null; activePlugin: null; bespokeDetails: null };

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
	customSummaryMetrics: Record<string, MetricValue>;
};
