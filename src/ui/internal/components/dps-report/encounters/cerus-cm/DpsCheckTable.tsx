import { InfoIcon } from "lucide-react";
import { useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AggregatedPlayer } from "../../../../../../types";
import type { DpsCheckRole } from "../../../../../../utils/dps-report/plugins/cerus-cm/parsers/dps-check/types";
import { useSortableData } from "../../../../hooks/useSortableData";
import { SortableHeader } from "../../../shared/SortableHeader";
import type { PluginEncounterProps } from "../types";

type FlattenedDpsRow = {
	originalPlayer: AggregatedPlayer;
	playerName: string;
	role: DpsCheckRole;
	dps: number;
	targetDps: number;
	difference: number;
	passed: boolean;
};

// Helper for pill styling based on role
const getRolePill = (role: FlattenedDpsRow["role"]) => {
	switch (role) {
		case "dps":
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
					DPS
				</span>
			);
		case "boondps":
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
					Boon DPS
				</span>
			);
		case "heal":
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
					Heal
				</span>
			);
		default:
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
					{role}
				</span>
			);
	}
};

export const DpsCheckTable = ({
	aggregatedPlayers,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const { dpsCheck } = details;

	const tableData = useMemo(() => {
		if (!dpsCheck) return [];

		return aggregatedPlayers.reduce((acc, player) => {
			const check = dpsCheck[player.account];

			if (check) {
				acc.push({
					originalPlayer: player,
					playerName: player.primaryName,
					role: check.role,
					dps: Math.round(check.dps),
					targetDps: Math.round(check.targetDps),
					difference: Math.round(check.dps - check.targetDps),
					passed: check.passed,
				});
			}

			return acc;
		}, [] as FlattenedDpsRow[]);
	}, [aggregatedPlayers, dpsCheck]);

	// Calculate totals for the footer
	const totals = useMemo(() => {
		return tableData.reduce(
			(acc, row) => {
				acc.targetDps += row.targetDps;
				acc.dps += row.dps;
				acc.difference += row.difference;
				return acc;
			},
			{ targetDps: 0, dps: 0, difference: 0 },
		);
	}, [tableData]);

	// Default sort initialized with tableData
	const {
		items: sortedRows,
		requestSort,
		sortConfig,
	} = useSortableData(tableData, { key: "dps" });

	const sortableProps = { requestSort, sortConfig };

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>50%-10% DPS Check</CardTitle>
				<CardDescription>
					Breakdown of player DPS relative to Second Green Phasing target.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Alert>
					<InfoIcon />
					<AlertDescription>
						<strong>Note:</strong> Assumes 6 DPS, 2 Boon DPS, 2 Healers.
						Aggregated averages may be inaccurate if players swapped roles
						across different logs.
					</AlertDescription>
				</Alert>
				<div className="rounded-md border overflow-hidden">
					<Table>
						<TableHeader className="bg-muted/50">
							<TableRow>
								<SortableHeader
									label="Player"
									sortKey="playerName"
									align="left"
									{...sortableProps}
								/>
								<SortableHeader
									label="Role"
									sortKey="role"
									align="left"
									{...sortableProps}
								/>
								<SortableHeader
									label="Target DPS"
									sortKey="targetDps"
									align="right"
									{...sortableProps}
								/>
								<SortableHeader
									label="Actual DPS"
									sortKey="dps"
									align="right"
									{...sortableProps}
								/>
								<SortableHeader
									label="Difference"
									sortKey="difference"
									align="right"
									{...sortableProps}
								/>
							</TableRow>
						</TableHeader>

						<TableBody>
							{sortedRows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="text-center text-muted-foreground py-6"
									>
										No DPS check data available.
									</TableCell>
								</TableRow>
							) : (
								sortedRows.map((row) => {
									const player = row.originalPlayer;
									const diffPrefix = row.difference > 0 ? "+" : "";

									return (
										<TableRow
											key={player.account}
											className="hover:bg-muted/40 transition-colors"
										>
											<TableCell className="font-medium w-full">
												<div className="flex items-center gap-2">
													{player.primaryIconUrl && (
														<img
															src={player.primaryIconUrl}
															alt=""
															className="w-5 h-5 rounded"
														/>
													)}
													<span>{player.primaryName}</span>
													<span className="text-xs text-muted-foreground">
														({player.account})
													</span>
												</div>
											</TableCell>

											<TableCell>{getRolePill(row.role)}</TableCell>

											<TableCell className="text-right text-muted-foreground">
												{row.targetDps.toLocaleString()}
											</TableCell>

											<TableCell className="text-right font-medium">
												{row.dps.toLocaleString()}
											</TableCell>

											<TableCell
												className={`text-right font-semibold ${
													row.passed ? "text-emerald-500" : "text-destructive"
												}`}
											>
												{diffPrefix}
												{row.difference.toLocaleString()}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>

						{sortedRows.length > 0 && (
							<TableFooter>
								<TableRow>
									<TableCell colSpan={2}>Squad Total</TableCell>
									<TableCell className="text-right">
										{totals.targetDps.toLocaleString()}
									</TableCell>
									<TableCell className="text-right">
										{totals.dps.toLocaleString()}
									</TableCell>
									<TableCell
										className={`text-right ${
											totals.difference >= 0
												? "text-emerald-500"
												: "text-destructive"
										}`}
									>
										{totals.difference > 0 ? "+" : ""}
										{totals.difference.toLocaleString()}
									</TableCell>
								</TableRow>
							</TableFooter>
						)}
					</Table>
				</div>
			</CardContent>
		</Card>
	);
};
