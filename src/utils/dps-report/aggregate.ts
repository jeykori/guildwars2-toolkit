import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	DpsReportSummary,
	LogPhase,
	LogSummary,
	PlayerSummary,
	TargetDamageStats,
} from "../../types";

export interface AggregationFilters {
	validLogIds: Set<string>;
	selectedPhaseNames: Set<string>;
	selectedTargetFilters: Set<string>;
	activeMetricsDictionary: CustomMetricDefinition[];
}

export function getActiveMetricsDictionary(
	dictionary: CustomMetricDefinition[] | undefined,
	logs: LogSummary[],
): CustomMetricDefinition[] {
	if (!dictionary || logs.length === 0) return [];

	const uniqueTriggerIds = new Set(logs.map((l) => l.triggerId));
	const isSingleEncounter = uniqueTriggerIds.size === 1;
	const activeTriggerId = isSingleEncounter
		? Array.from(uniqueTriggerIds)[0]
		: null;

	return dictionary.filter((metric) => {
		if (metric.isGlobal) return true;

		return (
			isSingleEncounter &&
			metric.triggerIds?.includes(activeTriggerId as number)
		);
	});
}

// ----------------------------------------------------------------------------
// NON-EXPORTED HELPER FUNCTIONS
// ----------------------------------------------------------------------------
export function applyAggregationRules(
	dataToAggregate: Record<string, number[]>,
	dictionary: CustomMetricDefinition[],
): Record<string, number> {
	const result: Record<string, number> = {};

	Object.entries(dataToAggregate).forEach(([id, values]) => {
		if (values.length === 0) return;

		const metricDef = dictionary.find((m) => m.id === id);
		if (!metricDef) return;

		// We do not squash GRAPH data into a single scalar value
		if (metricDef.displayType === "GRAPH") return;

		// TypeScript knows that if it's not a GRAPH, it has an `aggregation` property
		const rule = metricDef.aggregation;

		if (rule === "SUM") result[id] = values.reduce((a, b) => a + b, 0);
		if (rule === "MAX") result[id] = Math.max(...values);
		if (rule === "MIN") result[id] = Math.min(...values);
		if (rule === "AVG")
			result[id] = values.reduce((a, b) => a + b, 0) / values.length;
	});

	return result;
}

function calculatePhaseDamage(
	phaseTargets: Record<number, TargetDamageStats>,
	logPhaseData: LogPhase,
	localTargetMap: Map<number, string>,
	selectedTargetFilters: Set<string>,
) {
	let targetDamage = 0;
	let cleaveDamage = 0;

	Object.entries(phaseTargets).forEach(([targetIndexStr, dmgStats]) => {
		const tIndex = Number(targetIndexStr);
		const targetName = localTargetMap.get(tIndex) || "";

		cleaveDamage += dmgStats.damage;

		let includeInTargetDps = false;
		if (selectedTargetFilters.has("MAIN_BLOCKING")) {
			const priority = logPhaseData.targetPriorities[tIndex];
			if (priority === "MAIN" || priority === "BLOCKING") {
				includeInTargetDps = true;
			}
		}
		if (selectedTargetFilters.has(targetName)) {
			includeInTargetDps = true;
		}

		if (includeInTargetDps) {
			targetDamage += dmgStats.damage;
		}
	});

	return { targetDamage, cleaveDamage };
}

function formatCharactersAndProfessions(
	activeCharacters: Map<
		string,
		{ name: string; profession: string; iconUrl?: string; timePlayed: number }
	>,
) {
	const charactersList = Array.from(activeCharacters.values()).sort(
		(a, b) => b.timePlayed - a.timePlayed,
	);

	const uniqueProfessionsMap = new Map<
		string,
		{ name: string; iconUrl?: string }
	>();
	charactersList.forEach((c) => {
		if (!uniqueProfessionsMap.has(c.profession)) {
			uniqueProfessionsMap.set(c.profession, {
				name: c.profession,
				iconUrl: c.iconUrl,
			});
		}
	});

	return {
		characters: charactersList,
		professions: Array.from(uniqueProfessionsMap.values()),
		primaryName: charactersList[0]?.name,
		primaryIconUrl: charactersList[0]?.iconUrl,
	};
}

function processPlayerLogs(
	player: PlayerSummary,
	allLogs: LogSummary[], // Replace with `LogData[]` if your summary object uses the full log type
	filters: AggregationFilters,
) {
	const stats = {
		playerGroups: new Set<number>(),
		activeCharacters: new Map<
			string,
			{ name: string; profession: string; iconUrl?: string; timePlayed: number }
		>(),
		totalDurationMs: 0,
		totalDowns: 0,
		totalResses: 0,
		totalResDuration: 0,
		totalDamageTaken: 0,
		totalMechanics: {} as Record<number, number>,
		customMetricsData: {} as Record<string, number[]>,
		targetDamage: 0,
		cleaveDamage: 0,
		weightedQuickness: 0,
		weightedAlacrity: 0,
		validLogCount: 0,
	};

	player.logs.forEach((pLog) => {
		if (!filters.validLogIds.has(pLog.logId)) return;

		const logData = allLogs.find((l) => l.id === pLog.logId);
		if (!logData) return;

		const localTargetMap = new Map<number, string>();
		logData.targets.forEach((t) => {
			localTargetMap.set(t.index, t.name);
		});

		let logHasMatchingPhase = false;

		pLog.phases.forEach((pPhase, phaseIndex) => {
			const phaseData = logData.phases[phaseIndex];
			if (!phaseData || !filters.selectedPhaseNames.has(phaseData.name)) return;

			logHasMatchingPhase = true;
			const duration = phaseData.end - phaseData.start;

			stats.totalDurationMs += duration;
			stats.totalDowns += pPhase.downs;
			stats.totalResses += pPhase.resses;
			stats.totalResDuration += pPhase.resDuration;
			stats.totalDamageTaken += pPhase.damageTaken;
			stats.weightedQuickness += pPhase.quickness * duration;
			stats.weightedAlacrity += pPhase.alacrity * duration;

			// Accumulate standard mechanics
			Object.entries(pPhase.mechanics).forEach(([id, count]) => {
				const numId = Number(id);
				stats.totalMechanics[numId] =
					(stats.totalMechanics[numId] || 0) + count;
			});

			// Accumulate custom metrics
			Object.entries(pPhase.customMetrics || {}).forEach(([id, val]) => {
				if (!stats.customMetricsData[id]) stats.customMetricsData[id] = [];
				stats.customMetricsData[id].push(val);
			});

			// Calculate and accumulate target/cleave damage
			const dmg = calculatePhaseDamage(
				pPhase.targets,
				phaseData,
				localTargetMap,
				filters.selectedTargetFilters,
			);
			stats.targetDamage += dmg.targetDamage;
			stats.cleaveDamage += dmg.cleaveDamage;
		});

		if (logHasMatchingPhase) {
			stats.playerGroups.add(pLog.group);

			const existingChar = stats.activeCharacters.get(pLog.characterName);
			stats.activeCharacters.set(pLog.characterName, {
				name: pLog.characterName,
				profession: pLog.profession,
				iconUrl: pLog.professionIconUrl,
				timePlayed: (existingChar?.timePlayed ?? 0) + logData.durationMs,
			});

			stats.validLogCount++;
		}
	});

	return stats;
}

// ----------------------------------------------------------------------------
// EXPORTED AGGREGATOR
// ----------------------------------------------------------------------------
export function aggregateSquadData(
	logs: LogSummary[],
	selectedPhaseNames: Set<string>,
	activeDictionary: CustomMetricDefinition[],
): Record<string, number> {
	const customMetricsData: Record<string, number[]> = {};

	logs.forEach((log) => {
		// Collect Log-level metrics (applies to the whole pull, ignores UI phase selection)
		Object.entries(log.customMetrics || {}).forEach(([id, val]) => {
			if (!customMetricsData[id]) customMetricsData[id] = [];
			customMetricsData[id].push(val);
		});

		// Collect Phase-level metrics (respects UI phase selection)
		log.phases.forEach((phase) => {
			if (!selectedPhaseNames.has(phase.name)) return;

			Object.entries(phase.customMetrics || {}).forEach(([id, val]) => {
				if (!customMetricsData[id]) customMetricsData[id] = [];
				customMetricsData[id].push(val);
			});
		});
	});

	return applyAggregationRules(customMetricsData, activeDictionary);
}

export function aggregatePlayerData(
	data: DpsReportSummary,
	filters: AggregationFilters,
): AggregatedPlayer[] {
	return data.players.map((player) => {
		// 1. Process all logs for this player using the helper
		const stats = processPlayerLogs(player, data.logs, filters);

		// 2. Format sorted characters and unique professions
		const charData = formatCharactersAndProfessions(stats.activeCharacters);

		// 3. Math setup
		const durationSec = stats.totalDurationMs / 1000;

		return {
			account: player.account,
			primaryName: charData.primaryName ?? player.lastSeenCharacterName,
			primaryIconUrl: charData.primaryIconUrl,
			characters: charData.characters,
			professions: charData.professions,
			groups: Array.from(stats.playerGroups).sort(),
			totals: {
				downs: stats.totalDowns,
				resses: stats.totalResses,
				resDuration: stats.totalResDuration,
				mechanics: stats.totalMechanics,
			},
			averages: {
				targetDps: durationSec > 0 ? stats.targetDamage / durationSec : 0,
				cleaveDps: durationSec > 0 ? stats.cleaveDamage / durationSec : 0,
				quickness:
					stats.totalDurationMs > 0
						? stats.weightedQuickness / stats.totalDurationMs
						: 0,
				alacrity:
					stats.totalDurationMs > 0
						? stats.weightedAlacrity / stats.totalDurationMs
						: 0,
				damageTaken:
					stats.validLogCount > 0
						? stats.totalDamageTaken / stats.validLogCount
						: 0,
				mechanics: Object.fromEntries(
					Object.entries(stats.totalMechanics).map(([k, v]) => [
						k,
						stats.validLogCount > 0 ? v / stats.validLogCount : 0,
					]),
				),
			},
			customMetrics: applyAggregationRules(
				stats.customMetricsData,
				filters.activeMetricsDictionary,
			),
		};
	});
}
