import { useState } from "react";
import type {
	AggregatedPlayer,
	DpsReportSummary,
	MechanicSeverityGroup,
} from "../../../../types";
import { useToolkitComponents } from "../../../context";
import { useSortableData } from "../../hooks/useSortableData";
import { SortableHeader } from "../shared/SortableHeader";

type MechanicsViewProps = {
	players: AggregatedPlayer[];
	dictionary: DpsReportSummary["mechanicsDictionary"];
};

const sortSeverities = (
	dictionary: DpsReportSummary["mechanicsDictionary"],
	a: MechanicSeverityGroup,
	b: MechanicSeverityGroup,
) => {
	const preferredOrder = ["critical", "high", "medium", "low", "informational"];
	const indexA = preferredOrder.indexOf(a);
	const indexB = preferredOrder.indexOf(b);

	if (indexA === -1 && indexB === -1) {
		return (
			dictionary.findIndex((m) => m.severity === a) -
			dictionary.findIndex((m) => m.severity === b)
		);
	}
	if (indexA === -1) return -1;
	if (indexB === -1) return 1;
	return indexA - indexB;
};

export function MechanicsView({ players, dictionary }: MechanicsViewProps) {
	const { Table, TableBody, TableCell, TableHeader, TableRow } =
		useToolkitComponents();

	const [viewType, setViewType] = useState<"totals" | "averages">("totals");
	const {
		items: sortedPlayers,
		requestSort,
		sortConfig,
	} = useSortableData<AggregatedPlayer>(players, null);

	const availableSeverities = Array.from(
		new Set(dictionary.map((m) => m.severity)),
	).sort((a, b) => sortSeverities(dictionary, a, b));

	const [activeSeverity, setActiveSeverity] = useState<MechanicSeverityGroup>(
		availableSeverities[0] ?? "unknown",
	);

	// Mechanic array index acts as ID per standard GW2 logging conventions
	const columns = dictionary
		.map((mech, index) => ({ ...mech, originalIndex: index }))
		.filter((mech) => mech.severity === activeSeverity);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div className="flex gap-2 flex-wrap">
					{availableSeverities.map((sev) => (
						<button
							type="button"
							key={sev}
							onClick={() => setActiveSeverity(sev)}
							className={`px-3 py-1 text-xs rounded-full uppercase tracking-wider font-semibold transition-colors ${
								activeSeverity === sev
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							{sev}
						</button>
					))}
				</div>

				<div className="flex bg-muted rounded-lg p-1">
					{(["totals", "averages"] as const).map((type) => (
						<button
							type="button"
							key={type}
							onClick={() => setViewType(type)}
							className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
								viewType === type
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{type}
						</button>
					))}
				</div>
			</div>

			<div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden mt-4">
				<Table>
					<TableHeader>
						<TableRow>
							<SortableHeader
								label="Player"
								sortKey="name"
								align="left"
								className="w-full sticky left-0 z-20 bg-card"
								requestSort={requestSort}
								sortConfig={sortConfig}
							/>
							{columns.map((col) => (
								<SortableHeader
									key={col.originalIndex}
									label={col.name}
									sortKey={`${viewType}.mechanics.${col.originalIndex}`}
									title={col.description}
									requestSort={requestSort}
									sortConfig={sortConfig}
									className="max-w-[200px]"
								/>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{sortedPlayers.map((p) => (
							<TableRow
								key={p.account}
								className="group odd:bg-row-alt hover:bg-accent"
							>
								<TableCell className="font-medium sticky left-0 z-10 bg-card border-r group-odd:bg-row-alt group-hover:bg-accent transition-colors">
									{p.name}
								</TableCell>
								{columns.map((col) => {
									const val = p[viewType].mechanics[col.originalIndex] || 0;
									return (
										<TableCell key={col.originalIndex} className="text-right">
											{viewType === "averages" ? Number(val.toFixed(1)) : val}
										</TableCell>
									);
								})}
							</TableRow>
						))}
						{columns.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={100}
									className="h-24 text-center text-muted-foreground"
								>
									No mechanics recorded for this severity.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
