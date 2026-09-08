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
import type {
	InsatiableHungerCast,
	InsatiableHungerDetails,
	InsatiableOrb,
	InsatiableOrbOutcome,
	InsatiableUnresolvedReason,
} from "../../../../../../utils/dps-report/plugins/cerus-cm/insatiable-hunger";
import type { AggregatedPlayer, LogSummary } from "../../../../../../types";
import { PlayerNameCell } from "../../PlayerNameCell";
import type { PluginEncounterProps } from "../types";

const OUTCOME_LABELS: Record<InsatiableOrbOutcome, string> = {
	collected: "Collected",
	deleted: "Deleted by player",
	missed: "Missed (Empowered)",
	unresolved: "Unresolved",
};

const UNRESOLVED_REASON_LABELS: Record<InsatiableUnresolvedReason, string> = {
	"partial-ledger-no-terminal-proof": "partial ledger; no terminal proof",
	"no-observed-terminal-outcome": "no observed terminal outcome",
	"ambiguous-terminal-contact": "ambiguous terminal contact",
	"causal-contact-only": "mid-path contact is not deletion proof",
	"actor-stack-partial-ledger": "actor stack observed; ledger still partial",
	"actor-path-crossing-without-empowered":
		"orb crossed actor path without an Empowered event",
	"late-insatiable-application": "player application followed inferred contact",
	"phase-ended": "phase ended before terminal evidence",
	"mechanic-ended": "collect ended before terminal evidence",
	"split-2-bug-despawn": "known Split 2 decoration despawn",
	"missing-decoration": "expected large-orb decoration was absent",
};

const seconds = (milliseconds: number) =>
	`${(milliseconds / 1000).toFixed(3)}s`;

const shortLogId = (id: string) => id.split("-")[0] ?? id;

const allOrbs = (details: InsatiableHungerDetails) =>
	details.casts.flatMap((cast) => cast.orbs);

const getDeletedOrbCount = (details: InsatiableHungerDetails) =>
	allOrbs(details).filter((orb) => orb.accounting.deletedUnits > 0).length;

const getUnresolvedReasonRows = (detailsList: InsatiableHungerDetails[]) => {
	const rows = new Map<
		InsatiableUnresolvedReason,
		{ reason: InsatiableUnresolvedReason; orbs: number; units: number }
	>();
	for (const details of detailsList) {
		for (const orb of allOrbs(details)) {
			if (!orb.unresolvedReason || orb.accounting.unresolvedUnits === 0) continue;
			const row = rows.get(orb.unresolvedReason) ?? {
				reason: orb.unresolvedReason,
				orbs: 0,
				units: 0,
			};
			row.orbs += 1;
			row.units += orb.accounting.unresolvedUnits;
			rows.set(orb.unresolvedReason, row);
		}
		const missingDecorationUnits = details.collects.reduce(
			(total, collect) => total + collect.missingDecorationUnits,
			0,
		);
		if (missingDecorationUnits > 0) {
			const row = rows.get("missing-decoration") ?? {
				reason: "missing-decoration" as const,
				orbs: 0,
				units: 0,
			};
			row.orbs += Math.ceil(missingDecorationUnits / 3);
			row.units += missingDecorationUnits;
			rows.set("missing-decoration", row);
		}
	}
	return [...rows.values()].sort((a, b) => b.units - a.units);
};

const outcomeClass = (outcome: InsatiableOrbOutcome) => {
	if (outcome === "collected") {
		return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
	}
	if (outcome === "deleted") {
		return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
	}
	if (outcome === "missed") {
		return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
	}
	if (outcome === "unresolved") {
		return "bg-destructive/15 text-destructive";
	}
	return "bg-muted text-muted-foreground";
};

const Metric = ({ label, value }: { label: string; value: number | string }) => (
	<div className="min-w-28 rounded-lg border bg-muted/20 px-3 py-2">
		<div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
		<div className="mt-1 text-xs text-muted-foreground">{label}</div>
	</div>
);

const OutcomeBadge = ({ outcome }: { outcome: InsatiableOrbOutcome }) => (
	<Badge variant="secondary" className={outcomeClass(outcome)}>
		{OUTCOME_LABELS[outcome]}
	</Badge>
);

const OrbLedger = ({ orb }: { orb: InsatiableOrb }) => {
	const pickups = orb.events.filter((event) => event.type === "pickup");
	const empowered = orb.events.filter((event) => event.type === "empowered");
	const deletion = orb.events.find((event) => event.type === "delete");
	const entries = [
		...pickups.map((pickup) => ({
			key: `pickup-${pickup.player}-${pickup.time}`,
			label: `${pickup.player} · ${seconds(pickup.time)}`,
			className:
				"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		})),
		...empowered.map((transition) => ({
			key: `empowered-${transition.target}-${transition.time}`,
			label: `${transition.target} +${transition.assignedUnits ?? transition.stackDelta} · ${seconds(transition.time)}`,
			className:
				"border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
		})),
	];

	if (deletion) {
		entries.push({
			key: "deleted",
			label: `${deletion.player} deleted +${deletion.units} · ${seconds(deletion.time)}`,
			className:
				"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		});
	}

	if (orb.accounting.unresolvedUnits > 0) {
		entries.push({
			key: "unresolved",
			label: `Unresolved (${orb.unresolvedReason ? UNRESOLVED_REASON_LABELS[orb.unresolvedReason] : "missing reason"}) +${orb.accounting.unresolvedUnits}`,
			className: "border-destructive/20 bg-destructive/10 text-destructive",
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 font-medium tabular-nums">
				{orb.accounting.accountedUnits}/{orb.accounting.requiredUnits}
			</span>
			{entries.map((entry) => (
				<span
					key={entry.key}
					className={`inline-flex rounded-md border px-1.5 py-0.5 text-xs ${entry.className}`}
				>
					{entry.label}
				</span>
			))}
		</div>
	);
};

const CastGroup = ({ cast }: { cast: InsatiableHungerCast }) => {
	const accounted = cast.orbs.reduce(
		(total, orb) => total + orb.accounting.accountedUnits,
		0,
	);
	const required = cast.orbs.reduce(
		(total, orb) => total + orb.accounting.requiredUnits,
		0,
	);

	return (
		<section className="overflow-hidden rounded-lg border">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="font-medium">{cast.collectName}</span>
					<span className="font-mono text-xs text-muted-foreground">
						{seconds(cast.castTime)}
					</span>
					<Badge variant="outline">
						{cast.source.replace(" (Permanent)", "")}
					</Badge>
				</div>
				<span
					className={`text-xs font-medium tabular-nums ${
						accounted === required
							? "text-emerald-600 dark:text-emerald-400"
							: "text-destructive"
					}`}
				>
					{cast.orbs.length} orbs · {accounted}/{required} units
				</span>
			</div>
			<Table>
				<TableHeader className="bg-muted/15">
					<TableRow>
						<TableHead className="w-14">Orb</TableHead>
						<TableHead>Three-unit ledger</TableHead>
						<TableHead>Resolution</TableHead>
						<TableHead className="text-right">Ended</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{cast.orbs.map((orb) => (
						<TableRow key={`${cast.index}-${orb.index}`}>
							<TableCell className="font-medium">{orb.index + 1}</TableCell>
							<TableCell className="min-w-80">
								<OrbLedger orb={orb} />
							</TableCell>
							<TableCell>
								<OutcomeBadge outcome={orb.outcome} />
							</TableCell>
							<TableCell className="text-right text-xs text-muted-foreground tabular-nums">
								<div>{seconds(orb.endTime)}</div>
								<div>
									{orb.endPosition[0].toFixed(1)},{" "}
									{orb.endPosition[1].toFixed(1)}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
};

const CollectMatrix = ({
	selectedLogs,
	aggregatedPlayers,
}: {
	selectedLogs: SelectedLog[];
	aggregatedPlayers: AggregatedPlayer[];
}) => {
	const matrix = useMemo(() => {
		type Cell = { units: number; deleted: number };
		type PlayerRow = {
			key: string;
			player: Pick<
				AggregatedPlayer,
				"primaryName" | "primaryIconUrl" | "characters"
			>;
			cells: Map<string, Cell>;
		};
		const columns = new Map<
			string,
			{
				key: string;
				name: string;
				phase: string;
				missed: number;
				unresolved: number;
				expected: number;
				deleted: number;
			}
		>();
		const players = new Map<string, PlayerRow>();
		const resolvePlayer = (name: string) =>
			aggregatedPlayers.find(
				(player) =>
					player.primaryName === name ||
					player.characters.some((character) => character.name === name),
			);

		for (const { details } of selectedLogs) {
			for (const collect of details.collects) {
				const key = `${collect.phase}:${collect.name}`;
				const column = columns.get(key) ?? {
					key,
					name: collect.name,
					phase: collect.phase,
					missed: 0,
					unresolved: 0,
					expected: 0,
					deleted: 0,
				};
				column.missed += collect.missedUnits;
				column.unresolved += collect.unresolvedUnits;
				column.expected += collect.expectedOrbCount * 3;
				column.deleted += collect.deletedUnits;
				columns.set(key, column);

				for (const [name, units] of Object.entries(collect.players)) {
					const identity = resolvePlayer(name);
					const playerKey = identity?.account ?? name;
					const row = players.get(playerKey) ?? {
						key: playerKey,
						player: identity ?? { primaryName: name, characters: [] },
						cells: new Map<string, Cell>(),
					};
					const cell = row.cells.get(key) ?? { units: 0, deleted: 0 };
					cell.units += units.collectedUnits;
					cell.deleted += units.deletedUnits;
					row.cells.set(key, cell);
					players.set(playerKey, row);
				}
			}
		}

		const columnRows = [...columns.values()];
		const playerRows = [...players.values()].sort((a, b) => {
			const totals = (row: PlayerRow) =>
				[...row.cells.values()].reduce(
					(total, cell) => ({
						units: total.units + cell.units,
						deleted: total.deleted + cell.deleted,
					}),
					{ units: 0, deleted: 0 },
				);
			const aTotal = totals(a);
			const bTotal = totals(b);
			return (
				bTotal.deleted - aTotal.deleted ||
				bTotal.units - aTotal.units ||
				a.player.primaryName.localeCompare(b.player.primaryName)
			);
		});

		return { columns: columnRows, players: playerRows };
	}, [aggregatedPlayers, selectedLogs]);

	const format = (units: number, deleted = 0) => `${units} (${deleted})`;
	const sumCells = (cells: Map<string, { units: number; deleted: number }>) =>
		[...cells.values()].reduce(
			(total, cell) => ({
				units: total.units + cell.units,
				deleted: total.deleted + cell.deleted,
			}),
			{ units: 0, deleted: 0 },
		);
	const totals = matrix.columns.reduce(
		(total, column) => ({
			missed: total.missed + column.missed,
			unresolved: total.unresolved + column.unresolved,
			expected: total.expected + column.expected,
			deleted: total.deleted + column.deleted,
		}),
		{ missed: 0, unresolved: 0, expected: 0, deleted: 0 },
	);
	const phaseGroups = matrix.columns.reduce<
		{ phase: string; colSpan: number }[]
	>((groups, column) => {
		const previous = groups.at(-1);
		if (previous?.phase === column.phase) {
			previous.colSpan += 1;
		} else {
			groups.push({ phase: column.phase, colSpan: 1 });
		}
		return groups;
	}, []);

	return (
		<div className="overflow-x-auto rounded-lg border">
			<div className="border-b bg-muted/35 px-3 py-2 text-xs font-medium">
				Collect matrix <span className="text-muted-foreground">units (deleted)</span>
			</div>
			<Table>
				<TableHeader className="bg-muted/15">
					<TableRow>
						<TableHead rowSpan={2} className="sticky left-0 min-w-36 bg-background">Player / outcome</TableHead>
						{phaseGroups.map((group) => (
							<TableHead key={group.phase} colSpan={group.colSpan} className="text-center">
								{group.phase}
							</TableHead>
						))}
						<TableHead rowSpan={2} className="min-w-24 text-right">Final totals</TableHead>
					</TableRow>
					<TableRow>
						{matrix.columns.map((column) => (
							<TableHead key={column.key} className="min-w-32 text-right">
								<div className="text-xs font-normal text-muted-foreground">{column.name}</div>
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{matrix.players.map((row) => {
						const total = sumCells(row.cells);
						return (
							<TableRow key={row.key}>
								<TableCell className="sticky left-0 bg-background">
									<PlayerNameCell player={row.player} />
								</TableCell>
								{matrix.columns.map((column) => {
									const cell = row.cells.get(column.key) ?? { units: 0, deleted: 0 };
									return <TableCell key={column.key} className="text-right tabular-nums">{format(cell.units, cell.deleted)}</TableCell>;
								})}
								<TableCell className="text-right font-medium tabular-nums">{format(total.units, total.deleted)}</TableCell>
							</TableRow>
						);
					})}
					<TableRow>
						<TableCell className="sticky left-0 bg-background font-medium text-rose-600 dark:text-rose-400">Missed</TableCell>
						{matrix.columns.map((column) => <TableCell key={column.key} className="text-right tabular-nums">{format(column.missed)}</TableCell>)}
						<TableCell className="text-right font-medium tabular-nums">{format(totals.missed)}</TableCell>
					</TableRow>
					<TableRow>
						<TableCell className="sticky left-0 bg-background font-medium text-destructive">Unresolved</TableCell>
						{matrix.columns.map((column) => <TableCell key={column.key} className="text-right tabular-nums">{format(column.unresolved)}</TableCell>)}
						<TableCell className="text-right font-medium tabular-nums">{format(totals.unresolved)}</TableCell>
					</TableRow>
					<TableRow className="bg-muted/20 font-semibold">
						<TableCell className="sticky left-0 bg-muted">Totals</TableCell>
						{matrix.columns.map((column) => <TableCell key={column.key} className="text-right tabular-nums">{format(column.expected, column.deleted)}</TableCell>)}
						<TableCell className="text-right tabular-nums">{format(totals.expected, totals.deleted)}</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	);
};

const UnresolvedBreakdown = ({
	rows,
}: {
	rows: ReturnType<typeof getUnresolvedReasonRows>;
}) => {
	if (rows.length === 0) return null;

	return (
		<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
			<div className="mb-1.5 text-xs font-medium text-destructive">
				Strict unresolved review
			</div>
			<div className="flex flex-wrap gap-1.5">
				{rows.map((row) => (
					<Badge
						key={row.reason}
						variant="outline"
						className="border-destructive/20 bg-background text-destructive"
					>
						{UNRESOLVED_REASON_LABELS[row.reason]} · {row.units} unit
						{row.units === 1 ? "" : "s"} / {row.orbs} orb
						{row.orbs === 1 ? "" : "s"}
					</Badge>
				))}
			</div>
		</div>
	);
};

const SingleLogView = ({
	log,
	details,
	aggregatedPlayers,
}: {
	log: LogSummary;
	details: InsatiableHungerDetails;
	aggregatedPlayers: AggregatedPlayer[];
}) => {
	const selectedLogs = [{ log, details }];
	const unresolvedRows = getUnresolvedReasonRows([details]);

	return (
		<>
			<div className="flex flex-wrap items-stretch gap-2">
				<Metric label="expected orbs" value={details.accounting.totalOrbs} />
				<Metric
					label="confirmed player pickups"
					value={details.accounting.collectedUnits}
				/>
				<Metric
					label={`${getDeletedOrbCount(details)} strictly deleted orbs`}
					value={details.accounting.deletedUnits}
				/>
				<Metric
					label="missed units (Empowered)"
					value={details.accounting.missedUnits}
				/>
				<Metric
					label="strictly unresolved units"
					value={details.accounting.unresolvedUnits}
				/>
			</div>
			<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
				<span>
					{details.collects.length} expected collects · {details.casts.length} casts ·{" "}
					{getDeletedOrbCount(details)} deleted orbs
				</span>
				<a
					href={`https://dps.report/${log.id}`}
					target="_blank"
					rel="noreferrer"
					className="font-mono underline-offset-4 hover:underline"
				>
					{shortLogId(log.id)} on dps.report
				</a>
			</div>
			<UnresolvedBreakdown rows={unresolvedRows} />
			<CollectMatrix
				selectedLogs={selectedLogs}
				aggregatedPlayers={aggregatedPlayers}
			/>
			<div className="flex flex-col gap-3">
				{details.casts.map((cast) => (
					<CastGroup key={`${log.id}-${cast.index}`} cast={cast} />
				))}
			</div>
		</>
	);
};

type SelectedLog = { log: LogSummary; details: InsatiableHungerDetails };

const MultiLogView = ({
	selectedLogs,
	aggregatedPlayers,
}: {
	selectedLogs: SelectedLog[];
	aggregatedPlayers: AggregatedPlayer[];
}) => {
	const summary = useMemo(() => {
		const totals = {
			orbs: 0,
			stacks: 0,
			deletedUnits: 0,
			deletedOrbs: 0,
			empowered: 0,
			unresolved: 0,
			logsWithUnresolved: 0,
		};

		for (const { details } of selectedLogs) {
			totals.orbs += details.accounting.totalOrbs;
			totals.stacks += details.accounting.collectedUnits;
			totals.deletedUnits += details.accounting.deletedUnits;
			totals.empowered += details.accounting.missedUnits;
			totals.unresolved += details.accounting.unresolvedUnits;
			totals.deletedOrbs += getDeletedOrbCount(details);
			if (details.accounting.unresolvedUnits > 0) {
				totals.logsWithUnresolved += 1;
			}
		}

		return {
			totals,
			unresolvedRows: getUnresolvedReasonRows(
				selectedLogs.map(({ details }) => details),
			),
		};
	}, [selectedLogs]);

	return (
		<>
			<div className="flex flex-wrap items-stretch gap-2">
				<Metric
					label={`orbs across ${selectedLogs.length} logs`}
					value={summary.totals.orbs}
				/>
				<Metric label="confirmed player pickups" value={summary.totals.stacks} />
				<Metric
					label={`${summary.totals.deletedOrbs} strictly deleted orbs`}
					value={summary.totals.deletedUnits}
				/>
				<Metric
					label="missed units (Empowered)"
					value={summary.totals.empowered}
				/>
				<Metric
					label={`${summary.totals.logsWithUnresolved} logs need review`}
					value={summary.totals.unresolved}
				/>
			</div>
			<UnresolvedBreakdown rows={summary.unresolvedRows} />
			<CollectMatrix
				selectedLogs={selectedLogs}
				aggregatedPlayers={aggregatedPlayers}
			/>
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow>
							<TableHead>Log</TableHead>
							<TableHead>Collects / orbs</TableHead>
							<TableHead>Pickups</TableHead>
							<TableHead>Strict deletions</TableHead>
							<TableHead>Missed</TableHead>
							<TableHead>Review</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{selectedLogs.map(({ log, details }) => {
							const deletedOrbs = getDeletedOrbCount(details);
							return (
								<TableRow key={log.id}>
									<TableCell>
										<a
											href={`https://dps.report/${log.id}`}
											target="_blank"
											rel="noreferrer"
											className="font-mono font-medium underline-offset-4 hover:underline"
										>
											{shortLogId(log.id)}
										</a>
									</TableCell>
									<TableCell className="tabular-nums">
										{details.collects.length} / {details.accounting.totalOrbs}
									</TableCell>
									<TableCell className="tabular-nums">
										{details.accounting.collectedUnits}
									</TableCell>
									<TableCell className="tabular-nums">
										{details.accounting.deletedUnits}
										{deletedOrbs > 0 && (
											<span className="ml-1 text-xs text-muted-foreground">
												({deletedOrbs} orb{deletedOrbs === 1 ? "" : "s"})
											</span>
										)}
									</TableCell>
									<TableCell className="tabular-nums">
										{details.accounting.missedUnits}
									</TableCell>
									<TableCell>
										<Badge
											variant="secondary"
											className={
												details.accounting.unresolvedUnits === 0
													? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
													: "bg-destructive/15 text-destructive"
											}
										>
											{details.accounting.unresolvedUnits === 0
												? "Complete"
												: `${details.accounting.unresolvedUnits} unresolved`}
										</Badge>
										<div className="mt-1 text-xs text-muted-foreground tabular-nums">
											{details.accounting.accountedUnits}/
											{details.accounting.requiredUnits} accounted
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
			<p className="text-xs text-muted-foreground">
				Select one log to inspect each set and the exact three-unit ledger for
				every orb.
			</p>
		</>
	);
};

export const InsatiableHungerTable = ({
	aggregatedPlayers,
	filteredLogs,
	encounterDetailStates: { bespokeDetails: details },
}: PluginEncounterProps<25989>) => {
	const selectedLogs = useMemo(
		() =>
			filteredLogs.flatMap((log) => {
				const hunger = details?.insatiableHunger?.perLog[log.id];
				return hunger ? [{ log, details: hunger }] : [];
			}),
		[details, filteredLogs],
	);

	if (selectedLogs.length === 0) return null;
	const singleLog = selectedLogs.length === 1 ? selectedLogs[0] : null;

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Insatiable Hunger Orbs</CardTitle>
				<CardDescription>
					{singleLog
						? "Each set shows how every orb's three units were resolved."
						: `Combined orb outcomes for ${selectedLogs.length} selected logs.`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{singleLog ? (
					<SingleLogView
						log={singleLog.log}
						details={singleLog.details}
						aggregatedPlayers={aggregatedPlayers}
					/>
				) : (
					<MultiLogView
						selectedLogs={selectedLogs}
						aggregatedPlayers={aggregatedPlayers}
					/>
				)}
			</CardContent>
		</Card>
	);
};
