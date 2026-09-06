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
	"player-collected": "Collected",
	"player-deleted": "Deleted by player",
	"cerus-absorbed": "Cerus empowered",
	"embodiment-absorbed": "Embodiment empowered",
	"phase-despawned": "Phase despawned",
	"mechanic-ended": "Mechanic ended",
	"split-2-bug-despawn": "Split 2 bug despawn",
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
};

const seconds = (milliseconds: number) =>
	`${(milliseconds / 1000).toFixed(3)}s`;

const shortLogId = (id: string) => id.split("-")[0] ?? id;

const allOrbs = (details: InsatiableHungerDetails) => [
	...details.casts.flatMap((cast) => cast.orbs),
	...details.unassignedOrbs,
];

const getDespawnedUnits = (details: InsatiableHungerDetails) =>
	details.accounting.phaseDespawnedUnits +
	details.accounting.mechanicEndedUnits +
	details.accounting.split2BugDespawnUnits;

const getDeletedOrbCount = (details: InsatiableHungerDetails) =>
	allOrbs(details).filter((orb) => orb.accounting.deletedUnits > 0).length;

type PlayerInteractionRow = {
	key: string;
	player: Pick<
		AggregatedPlayer,
		"primaryName" | "primaryIconUrl" | "characters"
	>;
	pickups: number;
	deletedOrbs: number;
	deletedUnits: number;
	logs: number;
};

const getPlayerInteractionRows = (
	selectedLogs: SelectedLog[],
	aggregatedPlayers: AggregatedPlayer[],
) => {
	const byPlayer = new Map<string, PlayerInteractionRow & { logIds: Set<string> }>();
	const resolvePlayer = (name: string) =>
		aggregatedPlayers.find(
			(player) =>
				player.primaryName === name ||
				player.characters.some((character) => character.name === name),
		);
	for (const { log, details } of selectedLogs) {
		for (const orb of allOrbs(details)) {
			for (const pickup of orb.playerPickups) {
				const identity = resolvePlayer(pickup.player);
				const key = identity?.account ?? pickup.player;
				const row = byPlayer.get(key) ?? {
					key,
					player: identity ?? {
						primaryName: pickup.player,
						characters: [],
					},
					pickups: 0,
					deletedOrbs: 0,
					deletedUnits: 0,
					logs: 0,
					logIds: new Set<string>(),
				};
				row.pickups += pickup.stackDelta;
				row.logIds.add(log.id);
				byPlayer.set(key, row);
			}
			if (orb.accounting.deletedUnits > 0 && orb.deletedBy) {
				const identity = resolvePlayer(orb.deletedBy.player);
				const key = identity?.account ?? orb.deletedBy.player;
				const row = byPlayer.get(key) ?? {
					key,
					player: identity ?? {
						primaryName: orb.deletedBy.player,
						characters: [],
					},
					pickups: 0,
					deletedOrbs: 0,
					deletedUnits: 0,
					logs: 0,
					logIds: new Set<string>(),
				};
				row.deletedOrbs += 1;
				row.deletedUnits += orb.accounting.deletedUnits;
				row.logIds.add(log.id);
				byPlayer.set(key, row);
			}
		}
	}
	return [...byPlayer.values()]
		.map(({ logIds, ...row }) => ({ ...row, logs: logIds.size }))
		.sort(
			(a, b) =>
				b.deletedUnits - a.deletedUnits ||
				b.pickups - a.pickups ||
				a.player.primaryName.localeCompare(b.player.primaryName),
		);
};

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
	}
	return [...rows.values()].sort((a, b) => b.units - a.units);
};

const outcomeClass = (outcome: InsatiableOrbOutcome) => {
	if (outcome === "player-collected") {
		return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
	}
	if (outcome === "player-deleted") {
		return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
	}
	if (outcome.endsWith("absorbed")) {
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
	const entries = [
		...orb.playerPickups.map((pickup) => ({
			key: `pickup-${pickup.player}-${pickup.time}`,
			label: `${pickup.player} · ${seconds(pickup.time)}`,
			className:
				"border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		})),
		...orb.empoweredTransitions.map((transition) => ({
			key: `empowered-${transition.target}-${transition.time}`,
			label: `${transition.target} +${transition.assignedUnits ?? transition.stackDelta} · ${seconds(transition.time)}`,
			className:
				"border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
		})),
	];

	if (orb.accounting.deletedUnits > 0) {
		entries.push({
			key: "deleted",
			label: orb.deletedBy
				? `${orb.deletedBy.player} deleted +${orb.accounting.deletedUnits} · ${seconds(orb.deletedBy.time)}`
				: `Deleted +${orb.accounting.deletedUnits}`,
			className:
				"border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		});
	}

	const despawnedUnits =
		orb.accounting.phaseDespawnedUnits +
		orb.accounting.mechanicEndedUnits +
		orb.accounting.split2BugDespawnUnits;
	if (despawnedUnits > 0) {
		entries.push({
			key: "despawned",
			label: `${OUTCOME_LABELS[orb.outcome]} +${despawnedUnits}`,
			className: "border-border bg-muted text-muted-foreground",
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
					<span className="font-medium">Set {cast.index + 1}</span>
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
								<div>{seconds(orb.terminalTime)}</div>
								<div>
									{orb.terminalPosition[0].toFixed(1)},{" "}
									{orb.terminalPosition[1].toFixed(1)}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
};

const PlayerInteractionTable = ({
	rows,
	showLogs = false,
}: {
	rows: PlayerInteractionRow[];
	showLogs?: boolean;
}) => {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
				No player interactions were reconstructed in the selected logs.
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border">
			<div className="border-b bg-muted/35 px-3 py-2 text-xs font-medium">
				Player involvement
			</div>
			<Table>
				<TableHeader className="bg-muted/15">
					<TableRow>
						<TableHead>Player</TableHead>
						<TableHead className="text-right">Pickups</TableHead>
						<TableHead className="text-right">Deleted orbs</TableHead>
						<TableHead className="text-right">Deleted units</TableHead>
						{showLogs && <TableHead className="text-right">Logs</TableHead>}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.key}>
							<TableCell>
								<PlayerNameCell player={row.player} />
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{row.pickups}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{row.deletedOrbs || "—"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{row.deletedUnits || "—"}
							</TableCell>
							{showLogs && (
								<TableCell className="text-right tabular-nums">
									{row.logs}
								</TableCell>
							)}
						</TableRow>
					))}
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
	const playerRows = getPlayerInteractionRows(
		[{ log, details }],
		aggregatedPlayers,
	);
	const unresolvedRows = getUnresolvedReasonRows([details]);

	return (
		<>
			<div className="flex flex-wrap items-stretch gap-2">
				<Metric label="orbs reconstructed" value={details.accounting.totalOrbs} />
				<Metric
					label="confirmed player pickups"
					value={details.accounting.playerInsatiableUnits}
				/>
				<Metric
					label={`${getDeletedOrbCount(details)} strictly deleted orbs`}
					value={details.accounting.deletedUnits}
				/>
				<Metric
					label="Empowered leak units"
					value={details.accounting.actorEmpoweredUnits}
				/>
				<Metric
					label="strictly unresolved units"
					value={details.accounting.unresolvedUnits}
				/>
			</div>
			<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
				<span>
					{details.casts.length} sets · {getDeletedOrbCount(details)} deleted
					orbs · {getDespawnedUnits(details)} despawned units
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
			<PlayerInteractionTable rows={playerRows} />
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
			despawned: 0,
			unresolved: 0,
			logsWithUnresolved: 0,
		};

		for (const { details } of selectedLogs) {
			totals.orbs += details.accounting.totalOrbs;
			totals.stacks += details.accounting.playerInsatiableUnits;
			totals.deletedUnits += details.accounting.deletedUnits;
			totals.empowered += details.accounting.actorEmpoweredUnits;
			totals.despawned += getDespawnedUnits(details);
			totals.unresolved += details.accounting.unresolvedUnits;
			totals.deletedOrbs += getDeletedOrbCount(details);
			if (details.accounting.unresolvedUnits > 0) {
				totals.logsWithUnresolved += 1;
			}
		}

		return {
			totals,
			playerRows: getPlayerInteractionRows(selectedLogs, aggregatedPlayers),
			unresolvedRows: getUnresolvedReasonRows(
				selectedLogs.map(({ details }) => details),
			),
		};
	}, [aggregatedPlayers, selectedLogs]);

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
					label="Empowered leak units"
					value={summary.totals.empowered}
				/>
				<Metric
					label={`${summary.totals.logsWithUnresolved} logs need review`}
					value={summary.totals.unresolved}
				/>
			</div>
			<div className="text-xs text-muted-foreground">
				{summary.totals.despawned} units ended through a proven mechanic, phase,
				or Split 2 bug despawn.
			</div>
			<UnresolvedBreakdown rows={summary.unresolvedRows} />
			<PlayerInteractionTable rows={summary.playerRows} showLogs />
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow>
							<TableHead>Log</TableHead>
							<TableHead>Sets / orbs</TableHead>
							<TableHead>Pickups</TableHead>
							<TableHead>Strict deletions</TableHead>
							<TableHead>Empowered leaks</TableHead>
							<TableHead>Despawned</TableHead>
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
										{details.casts.length} / {details.accounting.totalOrbs}
									</TableCell>
									<TableCell className="tabular-nums">
										{details.accounting.playerInsatiableUnits}
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
										{details.accounting.actorEmpoweredUnits}
									</TableCell>
									<TableCell className="tabular-nums">
										{getDespawnedUnits(details)}
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
