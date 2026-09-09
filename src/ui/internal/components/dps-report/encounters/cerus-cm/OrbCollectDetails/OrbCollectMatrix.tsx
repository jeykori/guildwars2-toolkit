import { AlertTriangle, CircleHelp, InfoIcon } from "lucide-react";
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
import type { AggregatedPlayer } from "../../../../../../../types";
import { getCollectOrbs } from "../../../../../../../utils/dps-report/plugins/cerus-cm/parsers/orb-collects/orbs";
import type { OrbCollectDetails } from "../../../../../../../utils/dps-report/plugins/cerus-cm/parsers/orb-collects/types";
import { PlayerNameCell } from "../../../PlayerNameCell";

type SelectedLog = { log: { id: string }; details: OrbCollectDetails };
const knownIssueReasons = new Set([
	"phase-ended",
	"mechanic-ended",
	"split-2-bug-despawn",
]);

const formatPlayerCell = (units: number, deleted = 0) => {
	if (units === 0 && deleted === 0) return "-";
	if (deleted > 0) {
		return (
			<span>
				{units} <span className="text-teal-400 text-xs">({deleted})</span>
			</span>
		);
	}
	return `${units}`;
};

const formatOutcomeCell = (units: number) => {
	if (units === 0) return "-";
	return `${units}`;
};

const formatCollectTooltip = (name: string) => {
	return name
		.replace(/^p\d+-\d+_/, "")
		.replace(/[-_]/g, " ")
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

const getCollectNumber = (name: string) => {
	const match = name.match(/^p\d+-(\d+)_/);
	return match ? match[1] : "";
};

export const OrbCollectMatrix = ({
	selectedLogs,
	aggregatedPlayers,
}: {
	selectedLogs: SelectedLog[];
	aggregatedPlayers: AggregatedPlayer[];
}) => {
	const matrix = useMemo(() => {
		const columns = new Map<
			string,
			{
				name: string;
				phase: string;
				expected: number;
				missed: number;
				knownIssues: number;
				unresolved: number;
				deleted: number;
			}
		>();
		const players = new Map<
			string,
			{
				player: Pick<
					AggregatedPlayer,
					"primaryName" | "primaryIconUrl" | "characters"
				>;
				cells: Map<string, { units: number; deleted: number }>;
			}
		>();
		for (const { details } of selectedLogs)
			for (const collect of details.collects) {
				const key = `${collect.phase}:${collect.name}`;
				const orbs = getCollectOrbs(details.casts, collect.name);
				const column = columns.get(key) ?? {
					name: collect.name,
					phase: collect.phase,
					expected: 0,
					missed: 0,
					knownIssues: 0,
					unresolved: 0,
					deleted: 0,
				};
				column.expected += collect.expectedOrbCount * 3;
				for (const orb of orbs) {
					column.missed += orb.accounting.missedUnits;
					column.deleted += orb.accounting.deletedUnits;
					if (
						orb.unresolvedReason &&
						knownIssueReasons.has(orb.unresolvedReason)
					)
						column.knownIssues += orb.accounting.unresolvedUnits;
					else column.unresolved += orb.accounting.unresolvedUnits;
				}
				column.unresolved +=
					Math.max(0, collect.expectedOrbCount - orbs.length) * 3;
				columns.set(key, column);
				for (const [name, units] of Object.entries(collect.players)) {
					const identity = aggregatedPlayers.find(
						(player) =>
							player.primaryName === name ||
							player.characters.some((character) => character.name === name),
					);
					const playerKey = identity?.account ?? name;
					const row = players.get(playerKey) ?? {
						player: identity ?? { primaryName: name, characters: [] },
						cells: new Map(),
					};
					const cell = row.cells.get(key) ?? { units: 0, deleted: 0 };
					cell.units += units.collectedUnits;
					cell.deleted += units.deletedUnits;
					row.cells.set(key, cell);
					players.set(playerKey, row);
				}
			}
		return { columns: [...columns.entries()], players: [...players.entries()] };
	}, [aggregatedPlayers, selectedLogs]);

	const phaseGroups = useMemo(() => {
		const groups: { id: string; phase: string; count: number }[] = [];
		let currentGroup: { id: string; phase: string; count: number } | undefined;

		for (const [, col] of matrix.columns) {
			if (col.name.startsWith("split-")) continue;

			if (!currentGroup || currentGroup.phase !== col.phase) {
				currentGroup = {
					id: `phase-${col.phase}-${groups.length}`,
					phase: col.phase,
					count: 1,
				};
				groups.push(currentGroup);
			} else {
				currentGroup.count++;
			}
		}
		return groups;
	}, [matrix.columns]);

	const validColumns = useMemo(
		() => matrix.columns.filter(([, col]) => !col.name.startsWith("split-")),
		[matrix.columns],
	);

	const total = (
		field: "expected" | "missed" | "knownIssues" | "unresolved" | "deleted",
	) => matrix.columns.reduce((sum, [, column]) => sum + column[field], 0);

	const outcomeRows = [
		{
			field: "missed",
			colorClass: "text-red-500 dark:text-red-400",
			component: (
				<div className="flex items-center gap-1.5 whitespace-nowrap">
					<img
						src="https://wiki.guildwars2.com/images/9/9c/Empowered_%28Mursaat_Overseer%29.png"
						alt="Cerus"
						className="w-4 h-4 rounded-sm"
					/>
					<span>Cerus</span>
				</div>
			),
		},
		{
			field: "knownIssues",
			colorClass: "text-muted-foreground",
			component: (
				<div className="flex items-center gap-1.5 whitespace-nowrap">
					<CircleHelp className="w-4 h-4 text-muted-foreground" />
					<span>Known Issues</span>
				</div>
			),
		},
		{
			field: "unresolved",
			colorClass: "text-amber-600 dark:text-amber-500",
			component: (
				<div className="flex items-center gap-1.5 whitespace-nowrap">
					<AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
					<span>Unresolved</span>
				</div>
			),
		},
	] as const;

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Orb Collect Matrix</CardTitle>
				<CardDescription>
					Collected and deleted units grouped by orb collect. 1 Orb = 3 Units.
				</CardDescription>
				<Alert>
					<InfoIcon />
					<AlertDescription>
						Cell values show collected units, with deleted units in parentheses
						(e.g., <code>5 (1)</code>).
					</AlertDescription>
				</Alert>
			</CardHeader>
			<CardContent>
				<TooltipProvider>
					<div className="rounded-md border overflow-x-auto">
						<Table className="w-full min-w-225">
							<TableHeader className="bg-muted/50">
								<TableRow className="border-b-0">
									<TableHead rowSpan={2} className="w-55 px-3">
										Component
									</TableHead>
									{phaseGroups.map((group) => (
										<TableHead
											key={group.id}
											colSpan={group.count}
											className="text-center"
										>
											{group.phase}
										</TableHead>
									))}
									<TableHead rowSpan={2} className="w-25 text-right pr-4">
										Totals
									</TableHead>
								</TableRow>
								<TableRow>
									{validColumns.map(([key, column]) => (
										<TableHead
											key={key}
											className="p-0 w-17.5 text-xs font-semibold text-muted-foreground select-none"
										>
											<Tooltip>
												<TooltipTrigger className="w-full h-full flex items-center justify-end pr-4 pt-1 cursor-help">
													{getCollectNumber(column.name)}
												</TooltipTrigger>
												<TooltipContent side="right">
													<p>{formatCollectTooltip(column.name)}</p>
												</TooltipContent>
											</Tooltip>
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{matrix.players.map(([key, row]) => (
									<TableRow
										key={key}
										className="hover:bg-muted/40 transition-colors"
									>
										<TableCell className="w-55 font-medium truncate">
											<PlayerNameCell player={row.player} />
										</TableCell>
										{validColumns.map(([columnKey]) => {
											const cell = row.cells.get(columnKey) ?? {
												units: 0,
												deleted: 0,
											};
											return (
												<TableCell
													key={columnKey}
													className="w-17.5 text-right tabular-nums pr-4"
												>
													{formatPlayerCell(cell.units, cell.deleted)}
												</TableCell>
											);
										})}
										<TableCell className="w-25 text-right tabular-nums font-medium pr-4">
											{formatPlayerCell(
												[...row.cells.values()].reduce(
													(sum, cell) => sum + cell.units,
													0,
												),
												[...row.cells.values()].reduce(
													(sum, cell) => sum + cell.deleted,
													0,
												),
											)}
										</TableCell>
									</TableRow>
								))}
								{outcomeRows.map(({ field, colorClass, component }, index) => (
									<TableRow
										key={field}
										className={`hover:bg-muted/40 transition-colors ${
											index === 0 ? "border-t-6 border-border/80" : ""
										}
                    ${index === outcomeRows.length - 1 ? "border-b-6 border-border/80" : ""}
                    `}
									>
										<TableCell
											className={`w-55 font-medium truncate ${colorClass}`}
										>
											{component}
										</TableCell>
										{validColumns.map(([key]) => {
											const column = matrix.columns.find(
												([k]) => k === key,
											)?.[1];
											const val = column ? column[field] : 0;
											return (
												<TableCell
													key={key}
													className={`w-17.5 text-right tabular-nums pr-4 ${colorClass}`}
												>
													{formatOutcomeCell(val)}
												</TableCell>
											);
										})}
										<TableCell
											className={`w-25 text-right tabular-nums font-medium pr-4 ${colorClass}`}
										>
											{formatOutcomeCell(total(field))}
										</TableCell>
									</TableRow>
								))}
								<TableRow className="bg-muted/20 hover:bg-muted/30 transition-colors font-semibold">
									<TableCell className="w-55 truncate">Totals</TableCell>
									{validColumns.map(([key]) => {
										const column = matrix.columns.find(([k]) => k === key)?.[1];
										const expected = column ? column.expected : 0;
										const deleted = column ? column.deleted : 0;
										return (
											<TableCell
												key={key}
												className="w-17.5 text-right tabular-nums pr-4"
											>
												{formatPlayerCell(expected, deleted)}
											</TableCell>
										);
									})}
									<TableCell className="w-25 text-right tabular-nums pr-4">
										{formatPlayerCell(total("expected"), total("deleted"))}
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</div>
				</TooltipProvider>
			</CardContent>
		</Card>
	);
};
