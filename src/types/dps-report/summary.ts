import type { MechanicDictionaryItem } from "./base";
import type { CustomMetricDefinition } from "./custom-metrics";
import type { LogData, LogPlayerStats } from "./log";

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
	customMetricsDictionary: CustomMetricDefinition[];
	logs: LogSummary[];
	players: PlayerSummary[];
};
