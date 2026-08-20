export type Pos = readonly [number, number];

type Portal = {
	type: "chrono" | "scourge";
	portalFrom: Pos;
	portalTo?: Pos[];
};

type NoPortal = {
	type: "none";
};

type BaseFlower = {
	name: string;
	time: number;
};

export type FlowerTime = BaseFlower & (Portal | NoPortal);

export interface FlowerFail {
	actor: string;
	flowerName: string;
	initialHit: boolean;
	poolTick: boolean;
	death: boolean;
}

export interface TerroristPuddleFail {
	actor: string;
	flowerName: string;
	time: number;
}

export interface FlowerMechanicsResult {
	flowerFails: FlowerFail[];
	terroristPuddles: TerroristPuddleFail[];
	/** Maps player name to the total number of flowers they were alive for */
	playerAttempts: Record<string, number>;
}

export type FlowerFailMatrix = {
	fails: number;
	initialHit: number;
	poolTick: number;
	terroristPuddle: number;
	deaths: number;
	/** key = flowerName, value = total fails on this specific flower */
	flowerBreakdown: Record<string, number>;
};

export type FlowerFailures = {
	/** Record of player account to matrix */
	[phaseName: string]: Record<string, FlowerFailMatrix>;
};

export type AggregatedFlowerFailures = {
	/** key = player account */
	playerMatrix: Record<string, FlowerFailMatrix>;
	/** key = log id */
	perLog: Record<string, Record<string, FlowerFailMatrix>>;
};
