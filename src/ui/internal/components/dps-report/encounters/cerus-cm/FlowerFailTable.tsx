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
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AggregatedPlayer } from "../../../../../../types";
import type { FlowerFailMatrix } from "../../../../../../utils/dps-report/plugins/cerus-cm/parsers/flower-failures/types";
import { useSortableData } from "../../../../hooks/useSortableData";
import { formatPct } from "../../../../utils/format";
import { SortableHeader } from "../../../shared/SortableHeader";
import type { PluginEncounterProps } from "../types";

type FlattenedCerusRow = {
	originalPlayer: AggregatedPlayer;
	playerName: string;
	[key: string]: AggregatedPlayer | string | number | undefined;
};

type TableColumnKey =
	| "successRate"
	| "fails"
	| "initialHit"
	| "poolTick"
	| "terroristPuddle"
	| "deaths";

const COLUMN_CONFIGS: Record<
	TableColumnKey,
	{ label: string; colorIfPositive?: "red" | "orange" | "yellow" }
> = {
	successRate: { label: "Success Rate" },
	fails: { label: "Total Fails" },
	initialHit: { label: "Initial Hit" },
	poolTick: { label: "Pool Tick" },
	terroristPuddle: { label: "Terrorist Puddle", colorIfPositive: "red" },
	deaths: { label: "Deaths", colorIfPositive: "red" },
};

const SUB_COLUMN_KEYS = Object.keys(COLUMN_CONFIGS) as TableColumnKey[];

const EMPTY_MATRIX: FlowerFailMatrix = {
	fails: 0,
	totalAttempts: 0,
	initialHit: 0,
	poolTick: 0,
	terroristPuddle: 0,
	deaths: 0,
	flowerBreakdown: {},
};

export const FlowerFailTable = ({
	aggregatedPlayers,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const { flowerFailures } = details;

	const tableData = useMemo(() => {
		if (!flowerFailures) return [];

		return aggregatedPlayers.map((player) => {
			const matrix =
				flowerFailures.playerMatrix[player.account] || EMPTY_MATRIX;

			const totalAttempts = matrix.totalAttempts ?? 0;
			const fails = matrix.fails ?? 0;
			const successes = Math.max(0, totalAttempts - fails);
			const successRate =
				totalAttempts > 0 ? (successes / totalAttempts) * 100 : 0;

			const row: FlattenedCerusRow = {
				originalPlayer: player,
				playerName: player.primaryName,
				totalAttempts,
				successRate,
			};

			SUB_COLUMN_KEYS.forEach((key) => {
				if (key !== "successRate") {
					row[key] = matrix[key] ?? 0;
				}
			});

			return row;
		});
	}, [aggregatedPlayers, flowerFailures]);

	const {
		items: sortedRows,
		requestSort,
		sortConfig,
	} = useSortableData(tableData, { key: "fails" });

	const sortableProps = { requestSort, sortConfig };

	return (
		<Card>
			<CardHeader>
				<CardTitle>Flower Failures</CardTitle>
				<CardDescription>
					Detailed breakdown of Cerus CM flower mechanism failures per player.
				</CardDescription>
				<Alert>
					<InfoIcon />
					<AlertDescription>
						<ul className="list-none">
							<li>
								<strong>Fail:</strong> Took damage from initial hit or pool
								tick.
							</li>
							<li>
								<strong>Terrorist Puddle/Deaths:</strong> Tracked separately.
							</li>
						</ul>
					</AlertDescription>
				</Alert>
			</CardHeader>
			<CardContent>
				<TooltipProvider>
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

											{SUB_COLUMN_KEYS.map((key) => {
												const val = Number(row[key] ?? 0);
												const config = COLUMN_CONFIGS[key];

												if (key === "successRate") {
													const fails = Number(row.fails ?? 0);
													const total = Number(row.totalAttempts ?? 0);

													let rateColor = "";
													if (total > 0) {
														if (val === 100)
															rateColor = "text-teal-400 font-bold";
														else if (val > 80) rateColor = "text-emerald-400";
														else if (val >= 50) rateColor = "text-orange-400";
														else rateColor = "text-destructive";
													}

													return (
														<TableCell
															key={key}
															className={`text-right ${rateColor}`}
														>
															<Tooltip>
																<TooltipTrigger className="cursor-help">
																	{total > 0 ? formatPct(val, 0) : "-"}
																</TooltipTrigger>
																<TooltipContent>
																	<p>
																		{total > 0
																			? `${total - fails}/${total}`
																			: "-"}
																	</p>
																</TooltipContent>
															</Tooltip>
														</TableCell>
													);
												}

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
				</TooltipProvider>
			</CardContent>
		</Card>
	);
};
