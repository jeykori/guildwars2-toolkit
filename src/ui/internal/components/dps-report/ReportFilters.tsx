import React from "react";
import type { DpsReportSummary, LogSummary } from "../../../../types";
import { useToolkitComponents } from "../../../context";
import { formatMs } from "../../utils/format";

interface ReportFiltersProps {
	filteredLogs: LogSummary[];
	sortedAllLogs: LogSummary[];
	overview: DpsReportSummary["overview"];
	maxHpLeft: number;
	setMaxHpLeft: (val: number) => void;
	excludedLogIds: Set<string>;
	toggleLog: (id: string) => void;
	availablePhases: Array<{
		name: string;
		type: string;
		start: number;
		end: number;
	}>;
	selectedPhaseNames: Set<string>;
	togglePhase: (name: string, type: string) => void;
	availableTargets: Array<{ name: string; priorities: string[] }>;
	selectedTargetFilters: Set<string>;
	toggleTargetFilter: (key: string) => void;
}

const formatPriorityLabel = (priorities: string[], name: string) => {
	if (priorities.length === 0) return name;
	const titleCased = priorities.map(
		(p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
	);
	return `[${titleCased.join(", ")}] ${name}`;
};

export function ReportFilters({
	filteredLogs,
	sortedAllLogs,
	overview,
	maxHpLeft,
	setMaxHpLeft,
	excludedLogIds,
	toggleLog,
	availablePhases,
	selectedPhaseNames,
	togglePhase,
	availableTargets,
	selectedTargetFilters,
	toggleTargetFilter,
}: ReportFiltersProps) {
	const {
		Card,
		CardContent,
		Field,
		FieldLabel,
		Slider,
		Checkbox,
		Badge,
		Toggle,
	} = useToolkitComponents();

	return (
		<Card>
			<CardContent className="space-y-4">
				{/* Top Section: Max HP */}
				<div className="space-y-2 max-w-sm">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium">Maximum Health Remaining</h3>
						<span className="text-sm font-mono text-muted-foreground">
							{maxHpLeft}%
						</span>
					</div>
					<Slider
						value={[maxHpLeft]}
						min={0}
						max={100}
						step={1}
						onValueChange={(vals) =>
							setMaxHpLeft(Array.isArray(vals) ? vals[0] : vals)
						}
					/>
				</div>

				{/* Middle Section: Logs & Targets */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Included Logs */}
					<div className="space-y-2">
						<h3 className="text-sm font-medium">
							Included Logs ({filteredLogs.length})
						</h3>
						<div className="max-h-48 overflow-y-auto rounded-md border p-1">
							{sortedAllLogs
								.filter((l) => 100 - l.maxHealthPercentBurned <= maxHpLeft)
								.map((log) => {
									const hpLeft = 100 - log.maxHealthPercentBurned;
									const bossName =
										log.bossName || overview.fights[0]?.name || log.name;
									const timeStr = new Intl.DateTimeFormat(undefined, {
										timeStyle: "short",
									}).format(new Date(log.startTime));
									const isChecked = !excludedLogIds.has(log.id);

									return (
										<Field
											key={log.id}
											orientation="horizontal"
											className="cursor-pointer rounded-sm px-2 py-0.5 hover:bg-accent"
										>
											<Checkbox
												id={`log-${log.id}`}
												checked={isChecked}
												onCheckedChange={() => toggleLog(log.id)}
											/>
											<FieldLabel
												htmlFor={`log-${log.id}`}
												className="flex flex-1 items-center gap-3 cursor-pointer text-xs"
											>
												<span className="font-medium shrink-0">{timeStr}</span>
												<span className="flex-1 truncate text-muted-foreground">
													{bossName}
												</span>
												<span className="shrink-0">
													{formatMs(log.durationMs)}
												</span>
												<span className="shrink-0 font-medium">
													{hpLeft.toFixed(1)}% left
												</span>
												<span className="shrink-0">
													{log.success ? (
														<span className="text-emerald-500 font-bold">
															✓
														</span>
													) : (
														<span className="text-destructive font-bold">
															✕
														</span>
													)}
												</span>
											</FieldLabel>
										</Field>
									);
								})}
							{sortedAllLogs.filter(
								(l) => 100 - l.maxHealthPercentBurned <= maxHpLeft,
							).length === 0 && (
								<div className="p-2 text-sm text-muted-foreground">
									No logs match criteria.
								</div>
							)}
						</div>
					</div>

					{/* Target Filter */}
					<div className="space-y-2">
						<h3 className="text-sm font-medium">Target Filter</h3>
						<div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-md py-2">
							<Badge
								variant={
									selectedTargetFilters.has("MAIN_BLOCKING")
										? "default"
										: "secondary"
								}
								className="cursor-pointer"
								onClick={() => toggleTargetFilter("MAIN_BLOCKING")}
							>
								Main & Blocking
							</Badge>
							{availableTargets.map((t) => {
								const label = formatPriorityLabel(t.priorities, t.name);
								const isSelected = selectedTargetFilters.has(t.name);
								return (
									<Badge
										key={t.name}
										variant={isSelected ? "default" : "secondary"}
										className="cursor-pointer"
										onClick={() => toggleTargetFilter(t.name)}
									>
										{label}
									</Badge>
								);
							})}
						</div>
					</div>
				</div>

				<div className="h-px bg-border" />

				{/* Bottom Section: Phase Timeline */}
				<div className="space-y-4">
					<h3 className="text-sm font-medium">Select Phases</h3>
					<div className="flex flex-wrap items-center gap-2">
						{availablePhases.map((p, idx) => {
							const isSelected = selectedPhaseNames.has(p.name);
							const startSec = (p.start / 1000).toFixed(1);
							const endSec = (p.end / 1000).toFixed(1);

							return (
								<React.Fragment key={p.name}>
									<Toggle
										pressed={isSelected}
										onPressedChange={() => togglePhase(p.name, p.type)}
										title={`Start: ${startSec}s | End: ${endSec}s`}
										variant="outline"
										size="sm"
										className="data-pressed:bg-primary"
									>
										{p.name}
									</Toggle>

									{idx < availablePhases.length - 1 && (
										<div className="h-0.5 w-3 bg-border" />
									)}
								</React.Fragment>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
