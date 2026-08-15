import { useMemo } from "react";
import type { AggregatedPlayer } from "../../../../../../types";
import type { FlowerFailMatrix } from "../../../../../../utils/dps-report/plugins/cerus-cm/flower-failures/types";
import { useToolkitComponents } from "../../../../../context";
import { useSortableData } from "../../../../hooks/useSortableData";
import { SortableHeader } from "../../../shared/SortableHeader";
import type { PluginEncounterProps } from "../types";

type FlattenedCerusRow = {
	originalPlayer: AggregatedPlayer;
	playerName: string;
	[key: string]: AggregatedPlayer | string | number | undefined;
};

const COLUMN_CONFIGS: Record<
	keyof FlowerFailMatrix,
	{ label: string; colorIfPositive?: "red" | "orange" | "yellow" }
> = {
	fails: { label: "Total Fails" },
	initialHit: { label: "Initial Hit" },
	poolTick: { label: "Pool Tick" },
	terroristPuddle: { label: "Terrorist Puddle", colorIfPositive: "red" },
	deaths: { label: "Deaths", colorIfPositive: "red" },
};

const SUB_COLUMN_KEYS = Object.keys(
	COLUMN_CONFIGS,
) as (keyof FlowerFailMatrix)[];

const EMPTY_MATRIX: FlowerFailMatrix = {
	fails: 0,
	initialHit: 0,
	poolTick: 0,
	terroristPuddle: 0,
	deaths: 0,
};

export const FlowerFailTable = ({
	aggregatedPlayers,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Table,
		TableBody,
		TableCell,
		TableHeader,
		TableRow,
	} = useToolkitComponents();

	const { flowerFailures } = details;

	// Inside FlowerFailTable's useMemo:
	const tableData = useMemo(() => {
		// 1. Fallback to an empty array instead of null
		if (!flowerFailures) return [];

		return aggregatedPlayers.map((player) => {
			const matrix =
				flowerFailures.playerMatrix[player.account] || EMPTY_MATRIX;

			const row: FlattenedCerusRow = {
				originalPlayer: player,
				playerName: player.primaryName,
			};

			SUB_COLUMN_KEYS.forEach((key) => {
				row[key] = matrix[key] ?? 0;
			});

			return row;
		});
	}, [aggregatedPlayers, flowerFailures]);

	// 2. Call your hook unconditionally
	const {
		items: sortedRows,
		requestSort,
		sortConfig,
	} = useSortableData(tableData, "fails");

	const sortableProps = { requestSort, sortConfig };

	return (
		<Card>
			<CardHeader>
				<CardTitle>Flower Failures</CardTitle>
				<CardDescription>
					Detailed breakdown of Cerus CM flower mechanism failures per player.
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

								{SUB_COLUMN_KEYS.map((key) => (
									<SortableHeader
										key={key}
										label={COLUMN_CONFIGS[key].label}
										sortKey={key}
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

										{SUB_COLUMN_KEYS.map((key) => {
											const val = Number(row[key] ?? 0);
											const config = COLUMN_CONFIGS[key];

											let colorClass = "";
											if (val > 0 && config.colorIfPositive) {
												if (config.colorIfPositive === "red") {
													colorClass = "text-destructive font-bold";
												}
											}

											return (
												<TableCell
													key={key}
													className={`text-right ${colorClass}`}
												>
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
