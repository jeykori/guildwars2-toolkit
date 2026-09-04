import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
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
import { MALICE_TIMINGS } from "../../../../../../utils/dps-report/plugins/cerus-cm/parsers/malice-failures/constants";
import type { PluginEncounterProps } from "../types";

const PHASE_SEQUENCES = {
	"Phase 1": MALICE_TIMINGS.p1,
	"Phase 2": MALICE_TIMINGS.p2,
	"Phase 3": MALICE_TIMINGS.p3,
	"<10%": MALICE_TIMINGS.sub10,
} as const;

export const MaliceFailTable = ({
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const maliceFails = details?.maliceFails;

	// Aggregate all players into a single team timeline
	const { teamBreakdown, totalTeamFails } = useMemo(() => {
		const breakdown: Record<string, { fails: number; players: string[] }> = {};
		let totalFails = 0;

		if (maliceFails) {
			Object.values(maliceFails).forEach((playerStats) => {
				totalFails += playerStats.totalFails;

				Object.entries(playerStats.breakdown).forEach(([maliceName, stat]) => {
					if (!stat) return;
					if (!breakdown[maliceName]) {
						breakdown[maliceName] = { fails: 0, players: [] };
					}
					breakdown[maliceName].fails += stat.fails;
					breakdown[maliceName].players.push(...stat.players);
				});
			});
		}

		// Deduplicate player names per mechanic
		Object.values(breakdown).forEach((stat) => {
			stat.players = Array.from(new Set(stat.players));
		});

		return { teamBreakdown: breakdown, totalTeamFails: totalFails };
	}, [maliceFails]);

	if (!maliceFails) return null;

	// Determine overall badge styling
	const badgeColors =
		totalTeamFails === 0
			? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
			: totalTeamFails === 1
				? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
				: "bg-destructive/15 text-destructive hover:bg-destructive/25";

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Malice Performance</CardTitle>
				<CardDescription>
					Team execution of Malice drops. Hover over nodes to see missed
					placements.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="rounded-md border overflow-hidden">
					<TooltipProvider>
						<Table>
							<TableHeader className="bg-muted/50">
								<TableRow>
									<TableHead className="w-37.5">Status</TableHead>
									{Object.keys(PHASE_SEQUENCES).map((phase) => (
										<TableHead key={phase}>{phase}</TableHead>
									))}
								</TableRow>
							</TableHeader>

							<TableBody>
								<TableRow>
									{/* Overall Status Badge */}
									<TableCell>
										<Badge
											variant="secondary"
											className={`whitespace-nowrap ${badgeColors}`}
										>
											{totalTeamFails === 0
												? "Perfect"
												: `${totalTeamFails} Fail${totalTeamFails !== 1 ? "s" : ""}`}
										</Badge>
									</TableCell>

									{/* Phase Columns */}
									{Object.entries(PHASE_SEQUENCES).map(([phase, sequence]) => (
										<TableCell key={phase}>
											<div className="flex items-center">
												{sequence.map((timing, i) => {
													const stat = teamBreakdown[timing.name];
													const failCount = stat?.fails || 0;
													const isLast = i === sequence.length - 1;

													// Node Color Logic (Green = 0, Yellow = 1, Red = >1)
													let nodeClass = "bg-emerald-500 outline-transparent";
													if (failCount === 1) {
														nodeClass = "bg-amber-500 outline-amber-500/40";
													} else if (failCount > 1) {
														nodeClass = "bg-destructive outline-destructive/40";
													}

													return (
														<div
															key={timing.name}
															className="flex items-center"
														>
															<Tooltip>
																<TooltipTrigger>
																	<div
																		className={`w-3 h-3 rounded-full outline outline-offset-1 transition-all cursor-help ${nodeClass}`}
																	/>
																</TooltipTrigger>
																<TooltipContent>
																	<div className="flex flex-col">
																		<span className="font-semibold">
																			{timing.name}
																		</span>
																		{failCount > 0 && (
																			<div className="flex flex-col text-sm">
																				<span
																					className={
																						failCount === 1
																							? "text-amber-500 font-medium"
																							: "text-destructive font-medium"
																					}
																				>
																					{failCount} fail
																					{failCount !== 1 ? "s" : ""}
																				</span>
																				{stat &&
																					stat?.players.length > 0 &&
																					stat.players.map((player) => (
																						<span
																							key={player}
																							className="flex items-center gap-1.5 text-muted"
																						>
																							<span className="w-1 h-1 rounded-full bg-muted" />
																							{player}
																						</span>
																					))}
																			</div>
																		)}
																	</div>
																</TooltipContent>
															</Tooltip>

															{/* The connecting line between timeline nodes */}
															{!isLast && (
																<div className="w-5 h-0.6 bg-muted-foreground/20 mx-1" />
															)}
														</div>
													);
												})}
											</div>
										</TableCell>
									))}
								</TableRow>
							</TableBody>
						</Table>
					</TooltipProvider>
				</div>
			</CardContent>
		</Card>
	);
};
