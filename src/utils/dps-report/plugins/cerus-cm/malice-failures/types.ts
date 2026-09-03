import type { MALICE_TIMINGS } from "./constants";

export interface MaliceTime {
	name: string;
	/** Expected time of hit */
	time: number;
	/** For non-portal malice */
	dropLocation?: {
		location: readonly [number, number];
		radius: number;
		innerRadius?: number;
	};
	/** portalled malice */
	portalId?: string;
	/** Extra malice */
	failOnTarget?: boolean;
}

export type MaliceName =
	(typeof MALICE_TIMINGS)[keyof typeof MALICE_TIMINGS][number]["name"];

export interface PortalStat {
	fails: number;
	players: string[]; // Which players failed this mechanic (for tooltips)
}

export interface MaliceMetrics {
	totalFails: number;
	breakdown: Partial<Record<MaliceName, PortalStat>>;
}

export type MaliceFails = Record<string, MaliceMetrics>;
