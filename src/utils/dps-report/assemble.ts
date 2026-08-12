import type {
	DpsReportSummary,
	LogData,
	MechanicDictionaryItem,
	PlayerSummary,
} from "../../types/dps-report";

export const assembleReports = (logs: LogData[]): DpsReportSummary => {
	let successCount = 0;
	let totalDurationMs = 0;
	let overviewStartTime = 0;
	let overviewEndTime = 0;

	const fightsMap = new Map<string, { name: string; iconUrl: string }>();
	const masterDictionary: MechanicDictionaryItem[] = [];
	const nameToMasterId = new Map<string, number>();

	const playerMap = new Map<string, PlayerSummary>();
	const logsArr: DpsReportSummary["logs"] = [];

	for (const log of logs) {
		if (log.success) successCount++;
		totalDurationMs += log.durationMs;

		const startMs = new Date(log.startTime).getTime();
		const endMs = startMs + log.durationMs;
		if (!overviewStartTime || startMs < overviewStartTime)
			overviewStartTime = startMs;
		if (!overviewEndTime || endMs > overviewEndTime) overviewEndTime = endMs;

		// Track unique fights by name to power overview icons
		if (!fightsMap.has(log.name)) {
			fightsMap.set(log.name, {
				name: log.name,
				iconUrl: log.iconUrl,
			});
		}

		// Populate Log Summary Metadata
		logsArr.push({
			id: log.id,
			triggerId: log.triggerId,
			name: log.name,
			bossName: log.bossName,
			iconUrl: log.iconUrl,
			recordedBy: log.recordedBy,
			startTime: log.startTime,
			endTime: log.endTime,
			durationMs: log.durationMs,
			success: log.success,
			isCM: log.isCM,
			isLegendaryCM: log.isLegendaryCM,
			maxHealthPercentBurned: log.maxHealthPercentBurned,
			targets: log.targets,
			phases: log.phases,
		});

		// 1. Map local mechanic IDs to global master IDs for this assembly
		const localToMasterMap = new Map<number, number>();
		log.mechanicsDictionary.forEach((mech, localId) => {
			let masterId = nameToMasterId.get(mech.name);
			if (masterId === undefined) {
				masterId = masterDictionary.length;
				masterDictionary.push(mech);
				nameToMasterId.set(mech.name, masterId);
			}
			localToMasterMap.set(localId, masterId);
		});

		// 2. Aggregate players and translate mechanic indices
		for (const p of log.players) {
			let existingPlayer = playerMap.get(p.account);
			if (!existingPlayer) {
				existingPlayer = {
					account: p.account,
					lastSeenCharacterName: p.characterName,
					logs: [],
				};
				playerMap.set(p.account, existingPlayer);
			}

			// Keep the most recent character name seen (based on processing order)
			existingPlayer.lastSeenCharacterName = p.characterName;

			const mappedPhases = p.phases.map((phase) => {
				const remappedMechanics: Record<number, number> = {};

				for (const [localId, count] of Object.entries(phase.mechanics)) {
					const masterId = localToMasterMap.get(Number(localId));
					if (masterId !== undefined) {
						remappedMechanics[masterId] = count;
					}
				}

				return {
					...phase,
					mechanics: remappedMechanics,
				};
			});

			existingPlayer.logs.push({
				logId: log.id,
				characterName: p.characterName,
				profession: p.profession,
				group: p.group,
				phases: mappedPhases,
			});
		}
	}

	return {
		overview: {
			fights: Array.from(fightsMap.values()),
			logCount: logs.length,
			successCount,
			totalDurationMs,
			startTime: overviewStartTime
				? new Date(overviewStartTime).toISOString()
				: "",
			endTime: overviewEndTime ? new Date(overviewEndTime).toISOString() : "",
		},
		mechanicsDictionary: masterDictionary,
		logs: logsArr,
		players: Array.from(playerMap.values()),
	};
};
