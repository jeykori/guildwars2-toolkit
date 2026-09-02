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
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { FLOWER_PORTAL_IDS } from "../../../../../../utils/dps-report/plugins/cerus-cm/encounter-context/constants";
import { FLOWER_STRAT_PORTALS } from "../../../../../../utils/dps-report/plugins/cerus-cm/encounter-context/flower-portals";
import type { FlowerPortalId } from "../../../../../../utils/dps-report/plugins/cerus-cm/encounter-context/types";
import type { PluginEncounterProps } from "../types";

// Dynamically generate the sequences for the table headers/loops
const PHASE_SEQUENCES = {
	"Phase 1": Object.values(FLOWER_PORTAL_IDS.p1),
	"Phase 2": Object.values(FLOWER_PORTAL_IDS.p2),
	"Phase 3": Object.values(FLOWER_PORTAL_IDS.p3),
	"<10%": Object.values(FLOWER_PORTAL_IDS.p4),
} as const;

export const PortalPerformanceTable = ({
	aggregatedPlayers,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const portalPerformance = details?.portalPerformance;

	// Map the raw dictionary to an array we can map over, enriching with player display info
	const tableRows = useMemo(() => {
		if (!portalPerformance) return [];

		return Object.entries(portalPerformance).map(([account, stats]) => {
			const playerInfo = aggregatedPlayers.find((p) => p.account === account);
			return {
				account,
				primaryName: playerInfo?.primaryName || "Unknown",
				primaryIconUrl: playerInfo?.primaryIconUrl,
				...stats,
			};
		});
	}, [portalPerformance, aggregatedPlayers]);

	if (!tableRows.length) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Portal Execution</CardTitle>
				<CardDescription>
					Chronological breakdown of portal casts. Hover over failed portals for
					details.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="rounded-md border overflow-hidden">
					<TooltipProvider>
						<Table>
							<TableHeader className="bg-muted/50">
								<TableRow>
									<TableHead className="w-full">Player</TableHead>
									<TableHead>Overall</TableHead>
									{Object.keys(PHASE_SEQUENCES).map((phase) => (
										<TableHead key={phase}>{phase}</TableHead>
									))}
								</TableRow>
							</TableHeader>

							<TableBody>
								{tableRows.map((row) => {
									const passRate =
										row.totalExpected > 0
											? Math.round(
													(row.totalSuccessful / row.totalExpected) * 100,
												)
											: 0;

									return (
										<TableRow key={row.account}>
											{/* Player Info */}
											<TableCell className="font-medium">
												<div className="flex items-center gap-2">
													{row.primaryIconUrl && (
														<img
															src={row.primaryIconUrl}
															alt=""
															className="w-5 h-5 rounded"
														/>
													)}
													<div className="flex flex-col">
														<span>{row.primaryName}</span>
													</div>
												</div>
											</TableCell>

											{/* Overall Percentage */}
											<TableCell>
												<span
													className={`font-semibold ${
														passRate === 100
															? "text-emerald-500"
															: passRate >= 50
																? "text-amber-500"
																: "text-destructive"
													}`}
												>
													{passRate}%
												</span>
												<span className="text-xs text-muted-foreground ml-1">
													({row.totalSuccessful}/{row.totalExpected})
												</span>
											</TableCell>

											{/* Phase Columns (Zipper Layout) */}
											{Object.entries(PHASE_SEQUENCES).map(
												([phase, sequence]) => (
													<TableCell key={phase}>
														<div className="flex items-center gap-1.5">
															{sequence.map((portalId) => {
																const isMyJob =
																	(row.role === "chrono" &&
																		portalId.includes("_chr_")) ||
																	(row.role === "scourge" &&
																		portalId.includes("_scg_"));

																// If it's the other player's job, render a blank spacer to keep the grid perfectly aligned
																if (!isMyJob) {
																	return (
																		<div
																			key={portalId}
																			className="w-4 h-4 opacity-0"
																		/>
																	);
																}

																const stat =
																	row.portals[portalId as FlowerPortalId];

																// Phase ended early / wipe (Not reached)
																if (!stat || stat.expected === 0) {
																	return (
																		<div
																			key={portalId}
																			className="w-4 h-4 rounded-sm bg-muted-foreground/20"
																		/>
																	);
																}

																const expectedPortal =
																	FLOWER_STRAT_PORTALS.find(
																		(p) => p.id === portalId,
																	);
																const description =
																	expectedPortal?.description ||
																	"Unknown Portal";

																// Success vs Failure styling
																const isPerfect =
																	stat.successful === stat.expected;
																const isZero = stat.successful === 0;

																const pillClass = isPerfect
																	? "bg-emerald-500"
																	: isZero
																		? "bg-destructive"
																		: "bg-amber-500";

																return (
																	<Tooltip key={portalId}>
																		<TooltipTrigger>
																			<div
																				className={`w-4 h-4 rounded-sm cursor-help ${pillClass}`}
																			/>
																		</TooltipTrigger>
																		<TooltipContent>
																			<div className="flex flex-col">
																				<span className="font-semibold">
																					{description}
																				</span>
																				<span>
																					Success Rate: {stat.successful} /{" "}
																					{stat.expected}
																				</span>
																				{!isPerfect &&
																					stat.missedMechanics.length > 0 && (
																						<span className="text-destructive font-medium">
																							Missed:{" "}
																							{Array.from(
																								new Set(stat.missedMechanics),
																							).join(", ")}
																						</span>
																					)}
																			</div>
																		</TooltipContent>
																	</Tooltip>
																);
															})}
														</div>
													</TableCell>
												),
											)}
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</TooltipProvider>
				</div>
			</CardContent>
		</Card>
	);
};
