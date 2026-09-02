import { dpsCheckMetric, parseDpsCheckMetric } from "./dps-check";
import { buildEncounterContext } from "./encounter-context/context";
import {
	aggregateFlowerFailures,
	flowerFailuresMetrics,
	parseFlowerFailuresMetric,
} from "./flower-failures";
import {
	aggregatePortalPerformance,
	parsePortalPerformanceMetric,
} from "./portal-performance";
import type { CerusAggregatedDetails, CerusPlugin } from "./types";

const dictionary = [dpsCheckMetric, ...flowerFailuresMetrics];
const parsers = [
	parseDpsCheckMetric,
	parsePortalPerformanceMetric,
	parseFlowerFailuresMetric,
];
const aggregators = [aggregatePortalPerformance, aggregateFlowerFailures];

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
