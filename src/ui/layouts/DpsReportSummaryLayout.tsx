import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DpsReportSummary } from "../../types";
import { DamageStatsTable } from "../internal/components/dps-report/DamageStatsTable";
import { EncounterSummaryWidgets } from "../internal/components/dps-report/EncounterSummaryWidget";
import { EncounterDetailsView } from "../internal/components/dps-report/encounters/EncounterDetailsView";
import { LogsView } from "../internal/components/dps-report/LogsView";
import { MechanicsView } from "../internal/components/dps-report/MechanicsView";
import { ReportFilters } from "../internal/components/dps-report/ReportFilters";
import { ReportSummaryHeader } from "../internal/components/dps-report/ReportSummaryHeader";
import { SurvivabilityStatsTable } from "../internal/components/dps-report/SurvivabilityStatsTable";
import { useReportAggregator } from "../internal/hooks/useReportAggregator";

interface DpsReportSummaryLayoutProps {
	data: DpsReportSummary;
}

export function DpsReportSummaryLayout({ data }: DpsReportSummaryLayoutProps) {
	const {
		encounterState,
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
	} = useReportAggregator(data);

	const { overview } = data;

	const sortedAllLogs = useMemo(() => {
		return [...data.logs].sort(
			(a, b) =>
				new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
		);
	}, [data]);

	return (
		<TooltipProvider>
			<div className={"max-w-7xl mx-auto p-6 space-y-8"}>
				<ReportSummaryHeader overview={overview} />

				<ReportFilters
					filteredLogs={filteredLogs}
					sortedAllLogs={sortedAllLogs}
					overview={overview}
					maxHpLeft={maxHpLeft}
					setMaxHpLeft={setMaxHpLeft}
					excludedLogIds={excludedLogIds}
					toggleLog={toggleLog}
					availablePhases={availablePhases}
					selectedPhaseNames={selectedPhaseNames}
					togglePhase={togglePhase}
					availableTargets={availableTargets}
					selectedTargetFilters={selectedTargetFilters}
					toggleTargetFilter={toggleTargetFilter}
				/>

				<Tabs defaultValue="main" className="space-y-6">
					<TabsList>
						<TabsTrigger value="main">Performance Stats</TabsTrigger>
						<TabsTrigger value="mechanics">Mechanics</TabsTrigger>
						<TabsTrigger value="logs">Logs</TabsTrigger>
						{encounterState.triggerId && (
							<TabsTrigger value="encounter-details">
								Encounter Details
							</TabsTrigger>
						)}
					</TabsList>

					<TabsContent value="main" className="space-y-8">
						{encounterState.triggerId && (
							<EncounterSummaryWidgets
								metrics={activeMetricsDictionary}
								aggregatedSquadMetrics={aggregatedSquadMetrics}
								aggregatedPlayers={aggregatedPlayers}
								filteredLogs={filteredLogs}
							/>
						)}
						<DamageStatsTable players={aggregatedPlayers} />
						<SurvivabilityStatsTable players={aggregatedPlayers} />
					</TabsContent>

					<TabsContent value="mechanics">
						<MechanicsView
							players={aggregatedPlayers}
							dictionary={data.mechanicsDictionary}
						/>
					</TabsContent>

					<TabsContent value="logs">
						<LogsView logs={filteredLogs} />
					</TabsContent>

					{encounterState.triggerId && (
						<TabsContent value="encounter-details">
							<EncounterDetailsView
								aggregatedPlayers={aggregatedPlayers}
								encounterDetailStates={encounterState}
								filteredLogs={filteredLogs}
								aggregatedSquadMetrics={aggregatedSquadMetrics}
								metrics={activeMetricsDictionary}
							/>
						</TabsContent>
					)}
				</Tabs>
			</div>
		</TooltipProvider>
	);
}
