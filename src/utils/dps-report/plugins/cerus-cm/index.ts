import { buildEncounterContext } from "./encounter-context/context";
import { dpsCheckMetric, parseDpsCheckMetric } from "./parsers/dps-check";
import {
	aggregateFlowerFailures,
	flowerFailuresMetrics,
	parseFlowerFailuresMetric,
} from "./parsers/flower-failures";
import {
	aggregateMaliceFailures,
	maliceFailuresMetric,
	parseMaliceFailuresMetric,
} from "./parsers/malice-failures";
import {
	aggregatePortalPerformance,
	parsePortalPerformanceMetric,
} from "./parsers/portal-performance";
import type { CerusAggregatedDetails, CerusPlugin } from "./types";

const dictionary = [
	dpsCheckMetric,
	...flowerFailuresMetrics,
	maliceFailuresMetric,
];
const parsers = [
	parseDpsCheckMetric,
	parsePortalPerformanceMetric,
	parseFlowerFailuresMetric,
	parseMaliceFailuresMetric,
];
const aggregators = [
	aggregatePortalPerformance,
	aggregateFlowerFailures,
	aggregateMaliceFailures,
];

export const cerusCmPlugin = {
	triggerId: 25989,
	dictionary,
	parseLog: (report, combatReplay, mapped) => {
		const encounterContext = buildEncounterContext(report);

		parsers.forEach((parser) => {
			mapped = parser(report, combatReplay, mapped, encounterContext);
		});

		return mapped;
	},
	aggregateDetails: (...args) => {
		const combined = {} as CerusAggregatedDetails;

		for (const aggregator of aggregators) {
			Object.assign(combined, aggregator(...args));
		}

		return combined;
	},
} as const satisfies CerusPlugin;
