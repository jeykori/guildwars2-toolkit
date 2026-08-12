import type { AggregatedPlayer, DpsReportSummary } from "../../types";

interface AggregationFilters {
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
				validLogCount++;
			}
		});

		const durationSec = totalDurationMs / 1000;

		return {
			account: player.account,
			name: player.lastSeenCharacterName,
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
