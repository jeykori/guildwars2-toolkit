export * from "./elite-insights";

export type MechanicSeverityGroup =
	| "critical"
	| "high"
	| "medium"
	| "low"
	| "informational"
	| string;

export type TargetPriority = "MAIN" | "BLOCKING" | "NONBLOCKING";

export type MechanicDictionaryItem = {
	name: string;
	severity: MechanicSeverityGroup;
	description: string;
};

// ----------------------------------------------------------------------------
// SHARED BASE TYPES
// ----------------------------------------------------------------------------

export type LogPhase = {
	type: "encounter" | "instance" | "subphase" | "timeframe";
	name: string;
	start: number;
	end: number;
	/** Key: Target index */
	targetPriorities: Record<number, TargetPriority>;
};

export type TargetDamageStats = {
	damage: number;
	condiDamage: number;
	powerDamage: number;
	breakbarDamage: number;
};

export type PlayerPhaseStats = {
	quickness: number;
	alacrity: number;
	damageTaken: number;
	downs: number;
	resses: number;
	resDuration: number;
	/** Key: Mechanic ID (local for TLogData, global for TReportSummary) */
	mechanics: Record<number, number>;
	/** Key: Target index */
	targets: Record<number, TargetDamageStats>;
};

// ----------------------------------------------------------------------------
// WORKER/DATABASE LEVEL (Stored per-log)
// ----------------------------------------------------------------------------

export type LogPlayerStats = {
	account: string;
	characterName: string;
	profession: string;
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
};

// ----------------------------------------------------------------------------
// FRONTEND / ASSEMBLED LEVEL (Generated dynamically)
// ----------------------------------------------------------------------------

export type LogSummary = Omit<
	LogData,
	"version" | "players" | "mechanicsDictionary"
>;

export type PlayerLogStats = Omit<LogPlayerStats, "account"> & {
	logId: string;
};

export type PlayerSummary = {
	account: string;
	lastSeenCharacterName: string;
	logs: PlayerLogStats[];
};

export type DpsReportSummary = {
	overview: {
		fights: {
			name: string;
			iconUrl: string;
		}[];
		logCount: number;
		successCount: number;
		totalDurationMs: number;
		startTime: string;
		endTime: string;
	};
	/** Global dictionary mapping for all mechanics in this report */
	mechanicsDictionary: MechanicDictionaryItem[];
	logs: LogSummary[];
	players: PlayerSummary[];
};
