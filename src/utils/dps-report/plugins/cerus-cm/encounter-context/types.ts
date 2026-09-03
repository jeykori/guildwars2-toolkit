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
		radius: number; // The maximum/outer radius
		innerRadius?: number; // The minimum/inner radius (creates the donut)
	};
	/** Minimum distance betweeen portals */
	minDistance?: number;
	to?: {
		location: Array<readonly [number, number]>;
		radius: number; // The maximum/outer radius
		innerRadius?: number; // The minimum/inner radius (creates the donut)
	};
	mechanicRequirements: {
		mechanic: CerusMechanic;
		// [earliest acceptable open time, latest acceptable open time] (seconds into phase)
		validOpenWindow: readonly [number, number];
	}[];
	/**
	 * Optional manual cutoff in seconds.
	 * Number: If the phase duration is less than this value, the portal is forgiven and skipped.
	 * ccPhase: Instead of using the current phase as the cutoff, use the ccPhase to determine the cutoff. Used for attacks that disappear once breakbar appears.
	 */
	phasePushForgiveness?: {
		time: number;
		ccPhase?: string;
	};
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
