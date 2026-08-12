import type { AggregatedPlayer } from "../../../../types";
import { useToolkitComponents } from "../../../context";
import { useSortableData } from "../../hooks/useSortableData";
import { formatNum } from "../../utils/format";
import { SortableHeader } from "../shared/SortableHeader";
import { PlayerNameCell } from "./PlayerNameCell";

export function SurvivabilityStatsTable({
	players,
}: {
	players: AggregatedPlayer[];
}) {
	const {
		items: sortedPlayers,
		requestSort,
		sortConfig,
	} = useSortableData(players, "totals.downs");
	const sortableProps = { requestSort, sortConfig };

	const { Table, TableBody, TableCell, TableHeader, TableRow } =
		useToolkitComponents();

	return (
		<section className="space-y-4">
			<h2 className="text-lg font-semibold tracking-tight">Survivability</h2>
			<div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<SortableHeader
								label="Sub"
								sortKey="groups"
								align="left"
								overlapIcon={true}
								{...sortableProps}
							/>
							<SortableHeader
								label="Player"
								sortKey="name"
								align="left"
								{...sortableProps}
							/>
							<SortableHeader
								label="Account"
								sortKey="account"
								align="left"
								className="w-full"
								{...sortableProps}
							/>
							<SortableHeader
								label="Downs"
								sortKey="totals.downs"
								{...sortableProps}
							/>
							<SortableHeader
								label="Avg. Dmg Taken"
								sortKey="averages.damageTaken"
								{...sortableProps}
							/>
							<SortableHeader
								label="Resses"
								sortKey="totals.resses"
								{...sortableProps}
							/>
							<SortableHeader
								label="Res Time"
								sortKey="totals.resDuration"
								{...sortableProps}
							/>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sortedPlayers.map((p) => (
							<TableRow
								key={p.account}
								className="odd:bg-row-alt odd:hover:bg-accent"
							>
								<TableCell className="font-medium text-center">
									{p.groups.join(", ")}
								</TableCell>
								<TableCell className="font-medium">
									<PlayerNameCell player={p} />
								</TableCell>
								<TableCell className="text-muted-foreground">
									{p.account}
								</TableCell>
								<TableCell className="text-red-500 dark:text-red-400">
									{p.totals.downs}
								</TableCell>
								<TableCell>{formatNum(p.averages.damageTaken)}</TableCell>
								<TableCell className="text-emerald-500 dark:text-emerald-400">
									{p.totals.resses}
								</TableCell>
								<TableCell>{formatNum(p.totals.resDuration, 2)}s</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
