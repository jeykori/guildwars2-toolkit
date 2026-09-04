import type { EncounterPlugin } from "../../../../types";
import type { CerusMechanic } from "./encounter-context/types";
import type { DpsCheck } from "./parsers/dps-check/types";
import type {
	AggregatedFlowerFailures,
	FlowerFailures,
} from "./parsers/flower-failures/types";
import type { MaliceFails } from "./parsers/malice-failures/types";
import type { PortalPerformance } from "./parsers/portal-performance/types";

export type CerusPhase =
	| "Phase 1"
	| "Phase 2"
	| "Phase 3" // Same as 50%-10%
	| "Enraged Smash";

export interface PortalEvent {
	id: string; // The assigned ID from ExpectedPortal
	caster: string;
	type: "scourge" | "chrono";
	openTime: number;
	closeTime: number;
	locationFrom: readonly [number, number];
	locationTo: readonly [number, number];
	mechanics: {
		mechanic: CerusMechanic;
		expectedHitTime: number;
		validOpenWindow: readonly [number, number];
	}[];
}

export interface CerusEncounterContext {
	phaseStarts: Partial<Record<CerusPhase, number>>;
	/** Account names */
	roles: {
		heal: string[];
		boondps: string[];
	};
	portals: PortalEvent[]; // Only contains successfully identified portals
}

export type CerusLogDetails = {
	dpsCheck?: DpsCheck;
	flowerFailures?: FlowerFailures;
	maliceFails?: MaliceFails;
	portalPerformance?: PortalPerformance;
};

export type CerusAggregatedDetails = {
	dpsCheck?: DpsCheck;
	flowerFailures?: AggregatedFlowerFailures;
	maliceFails?: MaliceFails;
	portalPerformance?: PortalPerformance;
};

export type CerusPlugin = EncounterPlugin<
	CerusLogDetails,
	CerusAggregatedDetails
>;

export type CerusSubParser = (
	...args: [...Parameters<CerusPlugin["parseLog"]>, CerusEncounterContext]
) => ReturnType<CerusPlugin["parseLog"]>;
