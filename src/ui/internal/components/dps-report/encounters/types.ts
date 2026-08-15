import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	EncounterDetailStates,
	LogSummary,
	MetricValue,
	PluginsMap,
	SpecificEncounterState,
} from "../../../../../types";

type BaseEncounterProps = {
	aggregatedPlayers: AggregatedPlayer[];
	filteredLogs: LogSummary[];
	aggregatedSquadMetrics: Record<string, MetricValue>;
	metrics: CustomMetricDefinition[];
};

export type CommonEncounterProps = BaseEncounterProps & {
	encounterDetailStates: EncounterDetailStates;
};

export type PluginEncounterProps<K extends keyof PluginsMap> =
	BaseEncounterProps & {
		encounterDetailStates: SpecificEncounterState<K>;
	};
