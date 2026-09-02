import type { CerusMechanic, FlowerPortalId } from "../encounter-context/types";

export interface PortalStat {
	expected: number; // Number of times this specific portal was required
	successful: number; // Number of times it was perfectly executed
	missedMechanics: CerusMechanic[]; // Which mechanics were missed (for tooltips)
}

export interface PlayerPortalMetrics {
	role: "chrono" | "scourge";
	totalExpected: number;
	totalSuccessful: number;
	portals: Partial<Record<FlowerPortalId, PortalStat>>;
}

export type PortalPerformance = Record<string, PlayerPortalMetrics>;
