import { useMemo } from "react";
import { useToolkitComponents } from "../../context";
import { SortableHeader } from "../components/SortableHeader";
import type { AggregatedPlayer } from "../hooks/useReportAggregator";
import { useSortableData } from "../hooks/useSortableData";
import { formatNum, formatPct } from "../utils/format";

type DamageStatsTableProps = {
	players: AggregatedPlayer[];
};

export function DamageStatsTable({ players }: DamageStatsTableProps) {
	const { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } =
		useToolkitComponents();

	const {
		items: sortedPlayers,
		requestSort,
		sortConfig,
	} = useSortableData(players, "averages.targetDps");
	const sortableProps = { requestSort, sortConfig };

	const { totalTargetDps, totalCleaveDps, avgQuickness, avgAlacrity } =
		useMemo(() => {
			if (!players.length) {
				return {
					totalTargetDps: 0,
					totalCleaveDps: 0,
					avgQuickness: 0,
					avgAlacrity: 0,
				};
			}

			let target = 0,
				cleave = 0,
				quick = 0,
				alac = 0;

			players.forEach((p) => {
				target += p.averages.targetDps;
				cleave += p.averages.cleaveDps;
				quick += p.averages.quickness;
				alac += p.averages.alacrity;
			});

			return {
				totalTargetDps: target,
				totalCleaveDps: cleave,
				avgQuickness: quick / players.length,
				avgAlacrity: alac / players.length,
			};
		}, [players]);

	return (
		<section className="space-y-4">
			<h2 className="text-lg font-semibold tracking-tight">Damage & Boons</h2>
			<div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<SortableHeader
								label="Sub"
								sortKey="groups"
								align="left"
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
								label="Target DPS"
								sortKey="averages.targetDps"
								{...sortableProps}
							/>
							<SortableHeader
								label="Cleave DPS"
								sortKey="averages.cleaveDps"
								{...sortableProps}
							/>
							<SortableHeader
								label="Quickness"
								sortKey="averages.quickness"
								{...sortableProps}
							/>
							<SortableHeader
								label="Alacrity"
								sortKey="averages.alacrity"
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
								<TableCell className="font-medium">
									{p.groups.join(", ")}
								</TableCell>
								<TableCell className="font-medium">{p.name}</TableCell>
								<TableCell className="text-muted-foreground">
									{p.account}
								</TableCell>
								<TableCell>{formatNum(p.averages.targetDps)}</TableCell>
								<TableCell>{formatNum(p.averages.cleaveDps)}</TableCell>
								<TableCell className="text-yellow-500 dark:text-yellow-400">
									{formatPct(p.averages.quickness)}
								</TableCell>
								<TableCell className="text-purple-500 dark:text-purple-400">
									{formatPct(p.averages.alacrity)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell colSpan={3} className="font-bold">
								Totals (Avg. Boons)
							</TableCell>
							<TableCell className="font-bold text-foreground/50">
								{formatNum(totalTargetDps)}
							</TableCell>
							<TableCell className="font-bold text-foreground/50">
								{formatNum(totalCleaveDps)}
							</TableCell>
							<TableCell className="font-bold text-yellow-500/50 dark:text-yellow-400/50">
								{formatPct(avgQuickness)}
							</TableCell>
							<TableCell className="font-bold text-purple-500/50 dark:text-purple-400/50">
								{formatPct(avgAlacrity)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</div>
		</section>
	);
}
