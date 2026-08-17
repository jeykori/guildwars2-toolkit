import { useMemo } from "react";
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
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AggregatedPlayer } from "../../../../../../types";
import {
	CERUS_FLOWERS,
	type CerusFlowerName,
} from "../../../../../../utils/dps-report/plugins/cerus-cm/flower-failures";
import type { FlowerFailMatrix } from "../../../../../../utils/dps-report/plugins/cerus-cm/flower-failures/types";
import { useSortableData } from "../../../../hooks/useSortableData";
import { SortableHeader } from "../../../shared/SortableHeader";
import type { PluginEncounterProps } from "../types";

type FlattenedBreakdownRow = {
	originalPlayer: AggregatedPlayer;
	playerName: string;
} & Record<CerusFlowerName, number>;

const EMPTY_MATRIX: FlowerFailMatrix = {
	fails: 0,
	initialHit: 0,
	poolTick: 0,
	terroristPuddle: 0,
	deaths: 0,
	flowerBreakdown: {},
};

export const FlowerBreakdownTable = ({
	aggregatedPlayers,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const { flowerFailures } = details;

	const { tableData, columns } = useMemo(() => {
		if (!flowerFailures) return { tableData: [], columns: [] };

		const tableData = aggregatedPlayers.map((player) => {
			const matrix =
				flowerFailures.playerMatrix[player.account] || EMPTY_MATRIX;

			const row = {
				originalPlayer: player,
				playerName: player.primaryName,
			} as FlattenedBreakdownRow;

			CERUS_FLOWERS.forEach((flower) => {
				row[flower] = matrix.flowerBreakdown[flower] ?? 0;
			});

			return row;
		});

		return { tableData, columns: CERUS_FLOWERS };
	}, [aggregatedPlayers, flowerFailures]);

	// Default sort updated to playerName
	const {
		items: sortedRows,
		requestSort,
		sortConfig,
	} = useSortableData(tableData);

	const sortableProps = { requestSort, sortConfig };

	return (
		<Card>
			<CardHeader>
				<CardTitle>Fails per Flower</CardTitle>
				<CardDescription>
					Detailed breakdown showing which specific flowers players failed on.
				</CardDescription>
			</CardHeader>
			<CardContent>
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

								{columns.map((flowerName) => (
									<SortableHeader
										key={flowerName}
										label={flowerName}
										sortKey={flowerName}
										align="right"
										{...sortableProps}
									/>
								))}
							</TableRow>
						</TableHeader>

						<TableBody>
							{sortedRows.map((row) => {
								const player = row.originalPlayer;

								return (
									<TableRow
										key={player.account}
										className="hover:bg-muted/40 transition-colors"
									>
										<TableCell className="font-medium">
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

										{columns.map((flowerName) => {
											const val = Number(row[flowerName] ?? 0);
											return (
												<TableCell key={flowerName} className="text-right">
													{val > 0 ? val.toLocaleString() : "-"}
												</TableCell>
											);
										})}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
};
