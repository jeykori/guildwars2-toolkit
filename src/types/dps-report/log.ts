import type {
	LogPhase,
	MechanicDictionaryItem,
	PlayerPhaseStats,
} from "./base";

export type LogPlayerStats = {
	account: string;
	characterName: string;
	profession: string;
	professionIconUrl?: string;
	group: number;
	phases: PlayerPhaseStats[];
};

export type LogData = {
	id: string;
	triggerId: number;
	recordedBy: string;
	startTime: string;
	endTime: string;
	durationMs: number;
	success: boolean;
	isCM: boolean;
	isLegendaryCM: boolean;
	maxHealthPercentBurned: number;
	name: string;
	bossName?: string;
	iconUrl: string;
	targets: {
		id: number;
		/** Unique index used as key for other mappings (e.g. TLogPhase.targetPriorities, TPlayerPhaseStats.targets) */
		index: number;
		name: string;
		iconUrl?: string;
	}[];
	phases: LogPhase[];
	/** Local dictionary for this specific log */
	mechanicsDictionary: MechanicDictionaryItem[];
	players: LogPlayerStats[];
	/** Log-level custom metrics (e.g. squad DPS from 10%, enrage time left) */
	customMetrics: Record<string, number>;
};
