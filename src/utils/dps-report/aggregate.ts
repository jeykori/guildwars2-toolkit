import type { AggregatedPlayer, DpsReportSummary } from "../../types";

export interface AggregationFilters {
	validLogIds: Set<string>;
	selectedPhaseNames: Set<string>;
	selectedTargetFilters: Set<string>;
}

export function aggregatePlayerData(
	data: DpsReportSummary,
	filters: AggregationFilters,
): AggregatedPlayer[] {
	const { validLogIds, selectedPhaseNames, selectedTargetFilters } = filters;

	return data.players.map((player) => {
		const playerGroups = new Set<number>();

		// Track unique characters played in these specific logs
		const activeCharacters = new Map<
			string,
			AggregatedPlayer["characters"][number] & { timePlayed: number }
		>();

		let totalDurationMs = 0;
		let totalDowns = 0;
		let totalResses = 0;
		let totalResDuration = 0;
		let totalDamageTaken = 0;
		const totalMechanics: Record<number, number> = {};

		let targetDamage = 0;
		let cleaveDamage = 0;
		let weightedQuickness = 0;
		let weightedAlacrity = 0;
		let validLogCount = 0;

		player.logs.forEach((pLog) => {
			if (!validLogIds.has(pLog.logId)) return;

			const logData = data.logs.find((l) => l.id === pLog.logId);
			if (!logData) return;

			const localTargetMap = new Map<number, string>();
			logData.targets.forEach((t) => {
				localTargetMap.set(t.index, t.name);
			});

			let logHasMatchingPhase = false;

			pLog.phases.forEach((pPhase, phaseIndex) => {
				const phaseData = logData.phases[phaseIndex];
				if (!phaseData || !selectedPhaseNames.has(phaseData.name)) return;

				logHasMatchingPhase = true;
				const duration = phaseData.end - phaseData.start;
				totalDurationMs += duration;

				totalDowns += pPhase.downs;
				totalResses += pPhase.resses;
				totalResDuration += pPhase.resDuration;
				totalDamageTaken += pPhase.damageTaken;

				weightedQuickness += pPhase.quickness * duration;
				weightedAlacrity += pPhase.alacrity * duration;

				Object.entries(pPhase.mechanics).forEach(([id, count]) => {
					const numId = Number(id);
					totalMechanics[numId] = (totalMechanics[numId] || 0) + count;
				});

				Object.entries(pPhase.targets).forEach(([targetIndexStr, dmgStats]) => {
					const tIndex = Number(targetIndexStr);
					const targetName = localTargetMap.get(tIndex) || "";

					cleaveDamage += dmgStats.damage;

					let includeInTargetDps = false;
					if (selectedTargetFilters.has("MAIN_BLOCKING")) {
						const priority = phaseData.targetPriorities[tIndex];
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
			});

			if (logHasMatchingPhase) {
				playerGroups.add(pLog.group);
				// Record the character and profession they used in this specific log
				const existingChar = activeCharacters.get(pLog.characterName);
				activeCharacters.set(pLog.characterName, {
					name: pLog.characterName,
					profession: pLog.profession,
					iconUrl: pLog.professionIconUrl,
					timePlayed: (existingChar?.timePlayed ?? 0) + logData.durationMs,
				});
				validLogCount++;
			}
		});

		const durationSec = totalDurationMs / 1000;
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
		const uniqueProfessions = Array.from(uniqueProfessionsMap.values());

		return {
			account: player.account,
			// If they played characters in this filter, show the first one. Otherwise fallback to the assembly lastSeen name.
			primaryName: charactersList[0]?.name ?? player.lastSeenCharacterName,
			primaryIconUrl: charactersList[0]?.iconUrl,
			characters: charactersList,
			professions: uniqueProfessions,
			groups: Array.from(playerGroups).sort(),
			totals: {
				downs: totalDowns,
				resses: totalResses,
				resDuration: totalResDuration,
				mechanics: totalMechanics,
			},
			averages: {
				targetDps: durationSec > 0 ? targetDamage / durationSec : 0,
				cleaveDps: durationSec > 0 ? cleaveDamage / durationSec : 0,
				quickness:
					totalDurationMs > 0 ? weightedQuickness / totalDurationMs : 0,
				alacrity: totalDurationMs > 0 ? weightedAlacrity / totalDurationMs : 0,
				damageTaken: validLogCount > 0 ? totalDamageTaken / validLogCount : 0,
				mechanics: Object.fromEntries(
					Object.entries(totalMechanics).map(([k, v]) => [
						k,
						validLogCount > 0 ? v / validLogCount : 0,
					]),
				),
			},
		};
	});
}
