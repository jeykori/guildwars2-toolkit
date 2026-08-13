import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useMemo,
	useState,
} from "react";
import type {
	AggregatedPlayer,
	CustomMetricDefinition,
	DpsReportSummary,
	LogPhase,
	LogSummary,
	TargetPriority,
} from "../../../types";
import {
	aggregatePlayerData,
	aggregateSquadData,
	getActiveMetricsDictionary,
} from "../../../utils/dps-report";

export interface UseReportAggregatorResult {
	maxHpLeft: number;
	setMaxHpLeft: Dispatch<SetStateAction<number>>;
	excludedLogIds: Set<string>;
	toggleLog: (id: string) => void;
	availablePhases: {
		name: string;
		type: LogPhase["type"];
		start: number;
		end: number;
	}[];
	selectedPhaseNames: Set<string>;
	togglePhase: (name: string, type: string) => void;
	availableTargets: {
		name: string;
		priorities: TargetPriority[];
	}[];
	selectedTargetFilters: Set<string>;
	toggleTargetFilter: (filterKey: string) => void;
	filteredLogs: LogSummary[];
	aggregatedPlayers: AggregatedPlayer[];
	activeMetricsDictionary: CustomMetricDefinition[];
	aggregatedSquadMetrics: Record<string, number>;
}

export function useReportAggregator(
	data: DpsReportSummary | undefined,
): UseReportAggregatorResult {
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

	const activeMetricsDictionary = useMemo(() => {
		return getActiveMetricsDictionary(
			data?.customMetricsDictionary,
			filteredLogs,
		);
	}, [data?.customMetricsDictionary, filteredLogs]);

	const aggregatedSquadMetrics = useMemo(() => {
		return aggregateSquadData(
			filteredLogs,
			selectedPhaseNames,
			activeMetricsDictionary,
		);
	}, [filteredLogs, selectedPhaseNames, activeMetricsDictionary]);

	const aggregatedPlayers = useMemo(() => {
		if (!data) return [];

		return aggregatePlayerData(data, {
			validLogIds: new Set(filteredLogs.map((l) => l.id)),
			selectedPhaseNames,
			selectedTargetFilters,
			activeMetricsDictionary,
		});
	}, [
		data,
		filteredLogs,
		selectedPhaseNames,
		selectedTargetFilters,
		activeMetricsDictionary,
	]);

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
		activeMetricsDictionary,
		aggregatedSquadMetrics,
	};
}
