import type { EncounterPlugin } from "../../../types";
import { cerusCmPlugin } from "./cerus-cm";

const plugins: EncounterPlugin[] = [
	cerusCmPlugin,
	// dhuumPlugin,
];

export const getPluginsForTriggers = (
	triggerIds: number[],
): EncounterPlugin[] => {
	return plugins.filter((p) =>
		p.triggerIds.some((id) => triggerIds.includes(id)),
	);
};
