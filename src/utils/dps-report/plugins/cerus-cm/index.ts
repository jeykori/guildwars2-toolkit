import type { EncounterPlugin } from "../../../../types";
import { dpsCheckMetric, parseDpsCheckMetric } from "./dps-check";

const parsers = [parseDpsCheckMetric];

export const cerusCmPlugin: EncounterPlugin = {
	triggerIds: [25989], // Cerus CM trigger ID

	dictionary: [dpsCheckMetric],

	parseLog: (_raw, mapped) => {
		parsers.forEach((parser) => {
			mapped = parser(mapped);
		});
		return mapped;
	},
};
