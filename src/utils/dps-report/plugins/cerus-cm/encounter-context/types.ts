import type { CerusPhase } from "../types";
import type { FLOWER_PORTAL_IDS } from "./constants";

export type CerusMechanic = "malice" | "rage" | "flower" | "bad-collect";

export interface ExpectedPortal {
	id: string;
	description: string;
	phase: CerusPhase;
	type: "scourge" | "chrono";
	openTime: number;
	/** Variance in seconds */
	openWindow: number;
	from: {
		location: readonly [number, number];
		radius: number;
	};
	/** Minimum distance betweeen portals */
	minDistance?: number;
	to?: {
		location: Array<readonly [number, number]>;
		radius: number;
	};
	mechanicRequirements: {
		mechanic: CerusMechanic;
		// [earliest acceptable open time, latest acceptable open time] (seconds into phase)
		validOpenWindow: readonly [number, number];
	}[];
}

export interface RawPortalCast {
	caster: string;
	type: "scourge" | "chrono";
	openTime: number;
	closeTime: number;
	pos1: readonly [number, number];
	pos2: readonly [number, number];
}

export type FlowerPortalId = {
	[Phase in keyof typeof FLOWER_PORTAL_IDS]: (typeof FLOWER_PORTAL_IDS)[Phase][keyof (typeof FLOWER_PORTAL_IDS)[Phase]];
}[keyof typeof FLOWER_PORTAL_IDS];
