export type DpsCheckRole = "dps" | "boondps" | "heal";

export interface P3DpsCheck {
	role: DpsCheckRole;
	passed: boolean;
	dps: number;
	targetDps: number;
}

/** key: player account */
export type DpsCheck = Record<string, P3DpsCheck>;
