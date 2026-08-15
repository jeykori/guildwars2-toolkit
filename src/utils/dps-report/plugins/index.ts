import type { EncounterPlugin } from "../../../types";
import { cerusCmPlugin } from "./cerus-cm";

export const ENCOUNTER_PLUGINS = {
	[cerusCmPlugin.triggerId]: cerusCmPlugin,
	// [dhuumPlugin.triggerId]: dhuumPlugin,

	// biome-ignore lint/suspicious/noExplicitAny: This is the assembler
} satisfies Record<number, EncounterPlugin<any, any>>;
