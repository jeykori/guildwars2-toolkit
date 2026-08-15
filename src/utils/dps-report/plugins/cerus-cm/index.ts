import { dpsCheckMetric, parseDpsCheckMetric } from "./dps-check";
import {
	aggregateFlowerFailures,
	flowerFailuresMetric,
	parseFlowerFailuresMetric,
} from "./flower-failures";
import type { CerusAggregatedDetails, CerusPlugin } from "./types";

const dictionary = [dpsCheckMetric, flowerFailuresMetric];
const parsers = [parseDpsCheckMetric, parseFlowerFailuresMetric];
const aggregators = [aggregateFlowerFailures];

export const cerusCmPlugin = {
	triggerId: 25989, // Cerus CM trigger ID
	dictionary,
	parseLog: (report, combatReplay, mapped) => {
		parsers.forEach((parser) => {
			mapped = parser(report, combatReplay, mapped);
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
