import type { CerusPhase } from "../types";
import type { FLOWER_PORTAL_IDS } from "./constants";

export type CerusMechanic = "malice" | "rage" | "flower" | "bad-collect";

export interface ExpectedPortal {
	id: string;
	description: string;
	phase: CerusPhase;
	type: "scourge" | "chrono";

	/**
	 * The general baseline for when we expect the portal.
	 * Used for searching the log for a matching cast.
	 */
	openTime: number;
	from: {
		location: readonly [number, number];
		radius: number;
		innerRadius?: number;
	};
	minDistance?: number;
	to?: {
		location: Array<readonly [number, number]>;
		radius: number;
		innerRadius?: number;
	};

	mechanicRequirements: {
		mechanic: CerusMechanic;
		expectedCastTime: number;

		// Optional overrides in case a specific strat requires opening earlier/later
		bufferBeforeHit?: number; // defaults to 1 (second)
		bufferAfterHit?: number; // defaults to 1 (second)
	}[];

	/**
	 * If present, uses the start of this phase to determine if the expected hit would occur. A portal is NOT needed if the expected hit is after this phase.
	 */
	phasePushForgiveness?: string;
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
