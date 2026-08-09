import type { LogPhase, MechanicSeverityGroup } from "../../types/dps-report";
import type { DpsReportJson } from "../../types/dps-report/elite-insights";

export const SEVERITY_MAP: Record<string, MechanicSeverityGroup> = {
	Sev0: "critical",
	Sev1: "high",
	Sev2: "medium",
	Sev3: "low",
	Sev4: "informational",
};

export const PHASE_TYPE_MAP: Record<
	DpsReportJson["phases"][number]["phaseType"],
	LogPhase["type"]
> = {
	Encounter: "encounter",
	Instance: "instance",
	SubPhase: "subphase",
	TimeFrame: "timeframe",
};

export const IGNORED_MECHANICS = new Set([
	"dead",
	"downed",
	"got up",
	"res",
	"dc",
]);

export const BUFF_IDS = {
	QUICKNESS: 1187,
	ALACRITY: 30328,
} as const;
