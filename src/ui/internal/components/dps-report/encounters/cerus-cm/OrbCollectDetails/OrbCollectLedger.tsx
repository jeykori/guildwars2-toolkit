import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { LogSummary } from "../../../../../../../types";
import type {
	InsatiableHungerCast,
	InsatiableOrb,
	InsatiableUnresolvedReason,
	OrbCollectDetails,
} from "../../../../../../../utils/dps-report/plugins/cerus-cm/parsers/orb-collects/types";

type SelectedLog = { log: LogSummary; details: OrbCollectDetails };

const reasonLabels: Record<InsatiableUnresolvedReason, string> = {
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

const getEventColor = (type: string) => {
	switch (type) {
		case "pickup":
			// Player collected -> Green
			return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
		case "empowered":
			// Cerus absorbed -> Red
			return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
		case "delete":
			// Deleted -> Teal (Bonus/Good)
			return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";
		default:
			return "bg-muted text-muted-foreground border-border";
	}
};

const getOutcomeBadgeClass = (outcome: string) => {
	const lower = outcome.toLowerCase();
	if (lower.includes("miss") || lower.includes("absorb"))
		return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
	if (
		lower.includes("unresolved") ||
		lower.includes("partial") ||
		lower.includes("unknown")
	)
		return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
	if (lower.includes("delete"))
		return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";

	// Default to collected / perfect success
	return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
};

const getOutcomeRowClass = (outcome: string) => {
	const lower = outcome.toLowerCase();
	// Muted row background colors
	if (lower.includes("miss") || lower.includes("absorb"))
		return "bg-red-500/5 hover:bg-red-500/10 dark:bg-red-500/10 dark:hover:bg-red-500/15";
	if (
		lower.includes("unresolved") ||
		lower.includes("partial") ||
		lower.includes("unknown")
	)
		return "bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-500/10 dark:hover:bg-amber-500/15";
	if (lower.includes("delete"))
		return "bg-teal-500/5 hover:bg-teal-500/10 dark:bg-teal-500/10 dark:hover:bg-teal-500/15";

	// Default to collected / perfect success
	return "bg-green-500/5 hover:bg-green-500/10 dark:bg-green-500/10 dark:hover:bg-green-500/15";
};

const getHealthColor = (percent: number) => {
	if (percent < 50) return "text-red-600 dark:text-red-500";
	if (percent < 100) return "text-amber-600 dark:text-amber-500";
	return "text-green-600 dark:text-green-500";
};

const OrbLedger = ({ orb }: { orb: InsatiableOrb }) => (
	<div className="flex flex-wrap gap-1.5 text-xs">
		{orb.events.map((event) => (
			<span
				key={`${event.type}-${event.time}-${event.type === "pickup" || event.type === "delete" ? event.player : event.target}`}
				className={`rounded-md border px-1.5 py-0.5 ${getEventColor(event.type)}`}
			>
				{event.type === "pickup"
					? `${event.player} · ${(event.time / 1000).toFixed(3)}s`
					: event.type === "empowered"
						? `${event.target} +${event.assignedUnits}`
						: `${event.player} deleted +${event.units}`}
			</span>
		))}
		{orb.accounting.unresolvedUnits > 0 && (
			<span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
				Unresolved (
				{orb.unresolvedReason
					? reasonLabels[orb.unresolvedReason]
					: "missing reason"}
				)
			</span>
		)}
	</div>
);

const CastGroup = ({ cast }: { cast: InsatiableHungerCast }) => {
	const expectedUnits = cast.expectedOrbCount * 3;

	const unresolvedFromOrbs = cast.orbs.reduce(
		(sum, orb) => sum + orb.accounting.unresolvedUnits,
		0,
	);

	// Account for completely missing orbs
	const missingOrbsUnresolved =
		Math.max(0, cast.expectedOrbCount - cast.orbs.length) * 3;

	const totalUnresolved = unresolvedFromOrbs + missingOrbsUnresolved;
	const resolvedUnits = expectedUnits - totalUnresolved;

	return (
		<section className="overflow-hidden rounded-md border">
			<div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 font-medium">
				<div>
					{cast.collectName}{" "}
					<span className="ml-2 font-mono text-xs text-muted-foreground">
						{(cast.castTime / 1000).toFixed(3)}s
					</span>
				</div>
				<div className="text-sm font-normal text-muted-foreground">
					{cast.expectedOrbCount} Orbs - {resolvedUnits}/{expectedUnits} Units
				</div>
			</div>
			<div className="overflow-x-auto">
				<Table>
					<TableBody>
						{cast.orbs.map((orb) => (
							<TableRow
								key={`${cast.index}-${orb.index}`}
								className={`${getOutcomeRowClass(orb.outcome)} transition-colors`}
							>
								<TableCell className="w-16 text-center font-medium">
									{orb.index + 1}
								</TableCell>
								<TableCell>
									<OrbLedger orb={orb} />
								</TableCell>
								<TableCell className="w-32">
									<Badge
										variant="outline"
										className={`capitalize ${getOutcomeBadgeClass(orb.outcome)}`}
									>
										{orb.outcome.replace(/-/g, " ")}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	);
};

export const OrbCollectLedger = ({
	selectedLogs,
	selectedLogId,
	onSelectLog,
	onBack,
}: {
	selectedLogs: SelectedLog[];
	selectedLogId: string | null;
	onSelectLog: (id: string) => void;
	onBack: () => void;
}) => {
	const selected = selectedLogs.find(({ log }) => log.id === selectedLogId);

	const getLogUrl = (log: LogSummary) => `https://dps.report/${log.id}`;

	if (selected)
		return (
			<Card size="sm">
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle className="flex items-center gap-3">
								Orb Collect Ledger
								<a
									href={getLogUrl(selected.log)}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-1.5 font-mono text-sm font-normal text-muted-foreground bg-muted/50 hover:bg-muted hover:text-primary border px-2 py-0.5 rounded-md transition-colors"
									title="View on dps.report"
								>
									{selected.log.id.split("-")[0]}
									<ExternalLink className="h-3.5 w-3.5" />
								</a>
							</CardTitle>
							<CardDescription>
								Detailed ledger for the selected log.
							</CardDescription>
						</div>
						{selectedLogs.length > 1 && (
							<Button variant="outline" size="sm" onClick={onBack}>
								<ArrowLeft className="mr-2 h-4 w-4" /> Back
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{selected.details.casts.map((cast) => (
						<CastGroup key={`${selected.log.id}-${cast.index}`} cast={cast} />
					))}
				</CardContent>
			</Card>
		);

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Orb Collect Ledger</CardTitle>
				<CardDescription>
					Choose a log to inspect its individual orb ledger.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="rounded-md border overflow-hidden overflow-x-auto">
					<Table>
						<TableHeader className="bg-muted/50">
							<TableRow>
								<TableHead>Log ID / date</TableHead>
								<TableHead className="text-right">Total collected</TableHead>
								<TableHead className="text-right">Total deleted</TableHead>
								<TableHead className="text-right">
									Boss absorbed (missed)
								</TableHead>
								<TableHead className="text-right">Ledger health</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{selectedLogs.map(({ log, details }) => {
								const healthPercent =
									details.accounting.requiredUnits === 0
										? 100
										: ((details.accounting.requiredUnits -
												details.accounting.unresolvedUnits) /
												details.accounting.requiredUnits) *
											100;

								return (
									<TableRow
										key={log.id}
										onClick={() => onSelectLog(log.id)}
										className="cursor-pointer hover:bg-muted/40 transition-colors"
									>
										<TableCell>
											<div className="font-medium">{log.id.split("-")[0]}</div>
											<div className="text-xs text-muted-foreground">
												{new Date(log.startTime).toLocaleString()}
											</div>
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{details.accounting.collectedUnits}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{details.accounting.deletedUnits}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{details.accounting.missedUnits}
										</TableCell>
										<TableCell
											className={`text-right tabular-nums font-medium ${getHealthColor(healthPercent)}`}
										>
											{healthPercent.toFixed(1)}%
										</TableCell>
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
