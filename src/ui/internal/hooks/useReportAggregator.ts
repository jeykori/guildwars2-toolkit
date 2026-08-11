import { useEffect, useMemo, useState } from "react";
import type {
	DpsReportSummary,
	LogPhase,
	TargetPriority,
} from "../../../types";

export type AggregatedPlayer = {
	account: string;
	name: string;
	groups: number[];
	totals: {
		downs: number;
		resses: number;
		resDuration: number;
		mechanics: Record<number, number>;
	};
	averages: {
		targetDps: number;
		cleaveDps: number;
		quickness: number;
		alacrity: number;
		damageTaken: number;
		mechanics: Record<number, number>;
	};
};

export function useReportAggregator(data: DpsReportSummary | undefined) {
	const [maxHpLeft, setMaxHpLeft] = useState<number>(100);
	const [excludedLogIds, setExcludedLogIds] = useState<Set<string>>(new Set());
	const [selectedPhaseNames, setSelectedPhaseNames] = useState<Set<string>>(
		new Set(),
	);
	const [selectedTargetFilters, setSelectedTargetFilters] = useState<
		Set<string>
	>(new Set(["MAIN_BLOCKING"]));

	const filteredLogs = useMemo(() => {
		if (!data) return [];
		return data.logs.filter(
			(log) =>
				100 - log.maxHealthPercentBurned <= maxHpLeft &&
				!excludedLogIds.has(log.id),
		);
	}, [data, maxHpLeft, excludedLogIds]);

	const availablePhases = useMemo(() => {
		const map = new Map<
			string,
			{ type: LogPhase["type"]; minStart: number; minEnd: number }
		>();

		filteredLogs.forEach((log) => {
			log.phases.forEach((p) => {
				if (!map.has(p.name)) {
					map.set(p.name, { type: p.type, minStart: p.start, minEnd: p.end });
				} else {
					const entry = map.get(p.name);
					if (entry) {
						entry.minStart = Math.min(entry.minStart, p.start);
						entry.minEnd = Math.max(entry.minEnd, p.end);
					}
				}
			});
		});

		return Array.from(map.entries())
			.map(([name, pData]) => ({
				name,
				type: pData.type,
				start: pData.minStart,
				end: pData.minEnd,
			}))
			.sort((a, b) => a.start - b.start);
	}, [filteredLogs]);

	useEffect(() => {
		if (availablePhases.length > 0 && selectedPhaseNames.size === 0) {
			const defaultPhase =
				availablePhases.find(
					(p) => p.type === "encounter" || p.type === "instance",
				) || availablePhases[0];
			setSelectedPhaseNames(new Set([defaultPhase?.name ?? "unknown"]));
		}
	}, [availablePhases, selectedPhaseNames]);

	const togglePhase = (name: string, type: string) => {
		setSelectedPhaseNames((prev) => {
			const next = new Set(prev);

			if (type === "encounter" || type === "instance") {
				return new Set([name]);
			}

			availablePhases.forEach((p) => {
				if (p.type === "encounter" || p.type === "instance") {
					next.delete(p.name);
				}
			});

			if (next.has(name)) next.delete(name);
			else next.add(name);

			return next;
		});
	};

	const toggleLog = (id: string) => {
		setExcludedLogIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleTargetFilter = (filterKey: string) => {
		setSelectedTargetFilters((prev) => {
			if (filterKey === "MAIN_BLOCKING") {
				return new Set(["MAIN_BLOCKING"]);
			}

			const next = new Set(prev);
			next.delete("MAIN_BLOCKING");

			if (next.has(filterKey)) next.delete(filterKey);
			else next.add(filterKey);

			if (next.size === 0) return new Set(["MAIN_BLOCKING"]);

			return next;
		});
	};

	const availableTargets = useMemo(() => {
		const targetNameToPriorities = new Map<string, Set<TargetPriority>>();

		filteredLogs.forEach((log) => {
			const localTargetMap = new Map<number, string>();
			log.targets.forEach((t) => {
				localTargetMap.set(t.index, t.name);
			});

			log.phases.forEach((phase) => {
				if (selectedPhaseNames.has(phase.name)) {
					Object.entries(phase.targetPriorities).forEach(
						([tIndexStr, priority]) => {
							const tIndex = Number(tIndexStr);
							const targetName = localTargetMap.get(tIndex);

							if (!targetName) return;

							if (!targetNameToPriorities.has(targetName)) {
								targetNameToPriorities.set(targetName, new Set());
							}

							targetNameToPriorities.get(targetName)?.add(priority);
						},
					);
				}
			});
		});

		return Array.from(targetNameToPriorities.entries())
			.map(([name, prioritiesSet]) => {
				const priorities = Array.from(prioritiesSet);
				return { name, priorities };
			})
			.sort((a, b) => {
				const getScore = (prioList: TargetPriority[]) => {
					if (prioList.includes("MAIN")) return 1;
					if (prioList.includes("BLOCKING")) return 2;
					return 3;
				};
				const scoreA = getScore(a.priorities);
				const scoreB = getScore(b.priorities);
				if (scoreA !== scoreB) return scoreA - scoreB;
				return a.name.localeCompare(b.name);
			});
	}, [filteredLogs, selectedPhaseNames]);

	const aggregatedPlayers = useMemo(() => {
		if (!data) return [];

		const validLogIds = new Set(filteredLogs.map((l) => l.id));

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

					Object.entries(pPhase.targets).forEach(
						([targetIndexStr, dmgStats]) => {
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
						},
					);
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
					alacrity:
						totalDurationMs > 0 ? weightedAlacrity / totalDurationMs : 0,
					damageTaken: validLogCount > 0 ? totalDamageTaken / validLogCount : 0,
					mechanics: Object.fromEntries(
						Object.entries(totalMechanics).map(([k, v]) => [
							k,
							validLogCount > 0 ? v / validLogCount : 0,
						]),
					),
				},
			} as AggregatedPlayer;
		});
	}, [data, filteredLogs, selectedPhaseNames, selectedTargetFilters]);

	return {
		maxHpLeft,
		setMaxHpLeft,
		excludedLogIds,
		toggleLog,
		availablePhases,
		selectedPhaseNames,
		togglePhase,
		availableTargets,
		selectedTargetFilters,
		toggleTargetFilter,
		filteredLogs,
		aggregatedPlayers,
	};
}
