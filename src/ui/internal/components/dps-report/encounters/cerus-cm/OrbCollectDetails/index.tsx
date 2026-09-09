import { useEffect, useMemo, useState } from "react";
import type { PluginEncounterProps } from "../../types";
import { OrbCollectLedger } from "./OrbCollectLedger";
import { OrbCollectMatrix } from "./OrbCollectMatrix";

export const OrbCollectDetails = ({
	aggregatedPlayers,
	filteredLogs,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

	const selectedLogs = useMemo(
		() =>
			filteredLogs.flatMap((log) => {
				const orbCollects = details?.orbCollects?.perLog[log.id];
				return orbCollects ? [{ log, details: orbCollects }] : [];
			}),
		[details, filteredLogs],
	);

	// Automatically select the single log by default
	useEffect(() => {
		if (selectedLogs.length === 1 && selectedLogs[0]) {
			setSelectedLogId(selectedLogs[0].log.id);
		} else if (
			selectedLogs.length > 1 &&
			selectedLogId &&
			!selectedLogs.some((l) => l.log.id === selectedLogId)
		) {
			setSelectedLogId(null);
		}
	}, [selectedLogs, selectedLogId]);

	if (selectedLogs.length === 0) return null;

	return (
		<div className="flex flex-col gap-6">
			<OrbCollectMatrix
				selectedLogs={selectedLogs}
				aggregatedPlayers={aggregatedPlayers}
			/>
			<OrbCollectLedger
				selectedLogs={selectedLogs}
				selectedLogId={selectedLogId}
				onSelectLog={setSelectedLogId}
				onBack={() => setSelectedLogId(null)}
			/>
		</div>
	);
};
