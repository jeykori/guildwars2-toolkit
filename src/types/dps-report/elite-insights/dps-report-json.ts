/**
 * The raw json and metadata from Elite Insights Parser for a given permalink.
 * NOTE: not complete, mostly fields that are needed
 *
 * json: https://dps.report/getJson?permalink=B6nQ-20260803-230556_cerus
 * metadata: https://dps.report/getUploadMetadata?permalink=B6nQ-20260803-230556_cerus
 *
 * Documentation: https://baaron4.github.io/GW2-Elite-Insights-Parser/Json/
 */

export type DpsReportMetadata = {
	id: string;
	/** url */
	permalink: string;
	encounter: {
		bossId: number;
		boss?: string;
	};
};

export type DpsReportJson = {
	triggerID: number;
	mapID: number;
	name: string;
	success: boolean;
	players: Player[];
	/** url */
	icon: string;
	/** Character name */
	recordedBy: string;
	recordedAccountBy: string;
	/** 2026-08-03 11:06:01 -04 */
	timeStart: string;
	timeEnd: string;
	/** 2026-08-03 11:06:01 -04:00 */
	timeStartStd: string;
	timeEndStd: string;
	/** 00m 26s 289ms */
	duration: string;
	durationMS: number;
	isCM: boolean;
	isLegendaryCM: boolean;
	targets: Target[];
	mechanics: Mechanic[];
	phases: Phase[];
	combatReplayMetaData: {
		inchToPixel: number;
		pollingRate: number;
		sizes: [number, number];
	};
};

type Target = {
	id: number;
	name: string;
	finalHealth: number;
	finalBarrier: number;
	barrierPercent: number;
	healthPercentBurned: number;
	combatReplayData: CombatData;
};

type Player = {
	account: string;
	name: string;
	friendlyNPC: boolean;
	group: number;
	hasCommanderTag: boolean;
	profession: string;
	dpsTargets: Array<Dps[]>;
	dpsAll: Dps[];
	combatReplayData: CombatData;
	buffUptimes: BuffUptime[];
	buffUptimesActive: BuffUptime[];
	defenses: {
		damageTaken: number;
		downCount: number;
	}[];
	support: {
		resurrects: number;
		resurrectTime: number;
	}[];
	rotation: {
		/** skill ID */
		id: number;
		skills: {
			castTime: number;
			duration: number;
			timeGained: number;
			quickness: number;
		}[];
	}[];
};

type Dps = {
	dps: number;
	damage: number;
	condiDps: number;
	condiDamage: number;
	powerDps: number;
	powerDamage: number;
	breakbarDamage: number;
};

type CombatData = {
	start: number;
	end: number;
	iconURL?: string;
	/**
	 * List of 2D positions in pixels.
	 * The corresponding time for a given index i is
	 * ceil(Start / JsonCombatReplayMetaData.PollingRate) * JsonCombatReplayMetaData.PollingRate + i * JsonCombatReplayMetaData.PollingRate.
	 */
	positions: [number, number][];
	orientations: number[];
	/** time intervals per phase */
	dead: number[][];
	/** time intervals per phase */
	down: number[][];
};

type Mechanic = {
	name: string;
	fullName: string;
	description: string;
	severity: "Sev0" | "Sev1" | "Sev2" | "Sev3" | "Sev4";
	/** timeline of mechanics */
	mechanicsData: {
		time: number;
		/** 0 for Player */
		id: number;
		/** Player affected */
		actor: string;
	}[];
};

type PhaseBase = {
	name: string;
	start: number;
	end: number;
	/** target index and their priorities */
	targetPriorities: Record<number, "MAIN" | "BLOCKING" | "NONBLOCKING">;
	phaseType: string;
};

type PhaseMain = PhaseBase & {
	phaseType: "Encounter" | "Instance";
};

type SubPhase = PhaseBase & {
	phaseType: "SubPhase" | "TimeFrame";
	encounterPhase: number;
};

type Phase = PhaseMain | SubPhase;

/**
 * Might: b740
 * Quickness: b1187
 * Alacrity: b30328
 */
type BuffUptime = {
	id: number;
	/** array of phases */
	buffData: {
		/** Average stacks for stacking, Percent for single */
		uptime: number;
		/** Percent for stacking, 0 for single */
		presence: number;
	}[];
	/** [time, stacks] */
	states: [number, number][];
};
