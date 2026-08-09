import type {
	LogData,
	LogPhase,
	LogPlayerStats,
	MechanicDictionaryItem,
	TargetDamageStats,
	TargetPriority,
} from "../../types/dps-report";
import type { DpsReportJson } from "../../types/dps-report/elite-insights";
import {
	BUFF_IDS,
	IGNORED_MECHANICS,
	PHASE_TYPE_MAP,
	SEVERITY_MAP,
} from "./constants";

type TMappedReport = Omit<LogData, "id">;

export const mapDpsReport = (report: DpsReportJson): TMappedReport => {
	const mechanicsDictionary: MechanicDictionaryItem[] = [];
	const mechanicNameToIdMap = new Map<string, number>();

	// ============================================================================
	// 1. Calculate Max Health Percent Burned
	// ============================================================================
	const encounterPhase = report.phases.find(
		(p) => p.phaseType === "Encounter" || p.phaseType === "Instance",
	);

	const mainTargetIndices = new Set<number>();
	if (encounterPhase) {
		for (const [targetIndexStr, priority] of Object.entries(
			encounterPhase.targetPriorities,
		)) {
			if (priority === "MAIN") {
				mainTargetIndices.add(Number(targetIndexStr));
			}
		}
	}

	const maxHealthPercentBurned = report.targets.reduce((max, target, index) => {
		if (target.id < 0) return max;

		if (mainTargetIndices.has(index)) {
			return Math.max(max, target.healthPercentBurned ?? 0);
		}
		return max;
	}, 0);

	// ============================================================================
	// 2. Map Targets (Preserving original index)
	// ============================================================================
	const targets = report.targets.reduce(
		(acc, t, index) => {
			// Exclude junk targets, but keep the original index and real ID
			if (t.id >= 0) {
				acc.push({
					id: t.id,
					index: index,
					name: t.name,
					...(t.combatReplayData?.iconURL && {
						iconUrl: t.combatReplayData.iconURL,
					}),
				});
			}
			return acc;
		},
		[] as LogData["targets"],
	);

	// ============================================================================
	// 3. Map Phases
	// ============================================================================
	const phases: LogPhase[] = report.phases.map((p) => {
		const mappedTargetPriorities: Record<number, TargetPriority> = {};

		for (const [targetIndexStr, priority] of Object.entries(
			p.targetPriorities,
		)) {
			const tIndex = Number(targetIndexStr);
			const actualTarget = report.targets[tIndex];

			// Use the original array index as the key
			if (actualTarget && actualTarget.id >= 0) {
				mappedTargetPriorities[tIndex] = priority as TargetPriority;
			}
		}

		return {
			type: PHASE_TYPE_MAP[p.phaseType],
			name: p.name,
			start: p.start,
			end: p.end,
			targetPriorities: mappedTargetPriorities,
		};
	});

	// ============================================================================
	// 4. Process Mechanics
	// ============================================================================
	const mechanicsLogTimeline: Record<
		string,
		Record<number, Record<number, number>>
	> = {};
	const actorToAccountMap = new Map<string, string>();

	for (const p of report.players) {
		actorToAccountMap.set(p.name, p.account);
	}

	if (report.mechanics) {
		for (const mechanic of report.mechanics) {
			if (
				IGNORED_MECHANICS.has(mechanic.name.toLowerCase()) ||
				!mechanic.mechanicsData
			) {
				continue;
			}

			const severityGroup = SEVERITY_MAP[mechanic.severity] ?? "informational";
			const mechName = mechanic.fullName || mechanic.name;

			let mechId = mechanicNameToIdMap.get(mechName);
			if (mechId === undefined) {
				mechId = mechanicsDictionary.length;
				mechanicsDictionary.push({
					name: mechName,
					severity: severityGroup,
					description: mechanic.description || mechName,
				});
				mechanicNameToIdMap.set(mechName, mechId);
			}

			for (const data of mechanic.mechanicsData) {
				const account = actorToAccountMap.get(data.actor);
				if (!account) continue;

				if (!mechanicsLogTimeline[account]) mechanicsLogTimeline[account] = {};

				for (const [phaseIdx, phase] of report.phases.entries()) {
					if (data.time >= phase.start && data.time <= phase.end) {
						if (!mechanicsLogTimeline[account][phaseIdx]) {
							mechanicsLogTimeline[account][phaseIdx] = {};
						}

						const currentCount =
							mechanicsLogTimeline[account][phaseIdx][mechId] || 0;
						mechanicsLogTimeline[account][phaseIdx][mechId] = currentCount + 1;
					}
				}
			}
		}
	}

	// ============================================================================
	// 5. Process Players
	// ============================================================================
	const players: LogPlayerStats[] = [];

	for (const p of report.players) {
		if (p.friendlyNPC) continue;

		const playerStats: LogPlayerStats = {
			account: p.account,
			characterName: p.name,
			profession: p.profession,
			group: p.group,
			phases: [],
		};

		const quicknessBuff = p.buffUptimesActive?.find(
			(b) => b.id === BUFF_IDS.QUICKNESS,
		);
		const alacrityBuff = p.buffUptimesActive?.find(
			(b) => b.id === BUFF_IDS.ALACRITY,
		);

		for (const [phaseIdx, _phase] of report.phases.entries()) {
			const targetStats: Record<number, TargetDamageStats> = {};

			for (const [tIndex, target] of report.targets.entries()) {
				if (target.id < 0) continue;

				const dpsData = p.dpsTargets?.[tIndex]?.[phaseIdx];
				if (dpsData) {
					// Use original array index as the key
					targetStats[tIndex] = {
						damage: dpsData.damage ?? 0,
						condiDamage: dpsData.condiDamage ?? 0,
						powerDamage: dpsData.powerDamage ?? 0,
						breakbarDamage: dpsData.breakbarDamage ?? 0,
					};
				}
			}

			const quickness = quicknessBuff?.buffData?.[phaseIdx]?.uptime ?? 0;
			const alacrity = alacrityBuff?.buffData?.[phaseIdx]?.uptime ?? 0;
			const mechanicsForPhase =
				mechanicsLogTimeline[p.account]?.[phaseIdx] || {};

			playerStats.phases.push({
				quickness,
				alacrity,
				damageTaken: p.defenses?.[phaseIdx]?.damageTaken ?? 0,
				downs: p.defenses?.[phaseIdx]?.downCount ?? 0,
				resses: p.support?.[phaseIdx]?.resurrects ?? 0,
				resDuration: p.support?.[phaseIdx]?.resurrectTime ?? 0,
				mechanics: mechanicsForPhase,
				targets: targetStats,
			});
		}

		players.push(playerStats);
	}

	// ============================================================================
	// 6. Return Final Document
	// ============================================================================
	return {
		triggerId: report.triggerID,
		recordedBy: report.recordedAccountBy,
		startTime: new Date(report.timeStartStd).toISOString(),
		endTime: new Date(report.timeEndStd).toISOString(),
		durationMs: report.durationMS,
		success: report.success,
		isCM: report.isCM,
		isLegendaryCM: report.isLegendaryCM,
		maxHealthPercentBurned,
		name: report.name,
		iconUrl: report.icon,
		targets,
		phases,
		mechanicsDictionary,
		players,
	};
};
