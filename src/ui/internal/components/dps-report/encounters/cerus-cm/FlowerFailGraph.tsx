import { useMemo, useState } from "react";
import type { FlowerFailMatrix } from "../../../../../../utils/dps-report/plugins/cerus-cm/flower-failures/types";
import { useToolkitComponents } from "../../../../../context";
import type { PluginEncounterProps } from "../types";

const CHART_CONFIG = {
	value: {
		label: "Value",
		color: "hsl(var(--destructive))",
	},
};

const STAT_OPTIONS: { label: string; key: keyof FlowerFailMatrix }[] = [
	{ label: "Total Fails", key: "fails" },
	{ label: "Initial Hit", key: "initialHit" },
	{ label: "Pool Tick", key: "poolTick" },
	{ label: "Terrorist Puddle", key: "terroristPuddle" },
	{ label: "Deaths", key: "deaths" },
];

const PlayerOption = ({
	name,
	iconUrl,
}: {
	name: string;
	iconUrl?: string;
}) => (
	<div className="flex items-center gap-2 whitespace-nowrap text-sm">
		{iconUrl && (
			<img src={iconUrl} alt="" className="w-4 h-4 rounded-sm object-cover" />
		)}
		<span className="truncate">{name}</span>
	</div>
);

export function FlowerFailGraph({
	filteredLogs,
	aggregatedPlayers = [],
	encounterDetailStates,
}: PluginEncounterProps<25989>) {
	const {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectValue,
		ChartContainer,
		ChartTooltip,
		ChartTooltipContent,
		recharts: { CartesianGrid, Line, LineChart, XAxis, YAxis },
	} = useToolkitComponents();

	const details = encounterDetailStates.bespokeDetails;

	const [selectedPlayerName, setSelectedPlayerName] = useState<string>(
		() => aggregatedPlayers[0]?.primaryName || "",
	);

	const [selectedStat, setSelectedStat] =
		useState<keyof FlowerFailMatrix>("fails");

	const selectedPlayer = useMemo(
		() => aggregatedPlayers.find((p) => p.primaryName === selectedPlayerName),
		[aggregatedPlayers, selectedPlayerName],
	);

	const chartData = useMemo(() => {
		if (!details?.flowerFailures?.perLog) return [];

		// Sort logs chronologically
		const sortedLogs = [...filteredLogs].sort((a, b) => {
			const timeA = new Date(a.startTime || 0).getTime();
			const timeB = new Date(b.startTime || 0).getTime();
			return timeA - timeB;
		});

		return sortedLogs.map((log, index) => {
			let plotValue = 0;

			// Access perLog here
			const logFailure = details?.flowerFailures?.perLog[log.id];
			if (selectedPlayer && logFailure) {
				const matrix = logFailure[selectedPlayer.account];
				if (matrix) {
					plotValue = matrix[selectedStat] ?? 0;
				}
			}

			const dateStr = log.startTime
				? new Date(log.startTime).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})
				: `Log ${index + 1}`;

			return {
				key: log.id,
				name: dateStr,
				value: plotValue,
				fullDate: log.startTime ? new Date(log.startTime).toLocaleString() : "",
				logId: log.id,
			};
		});
	}, [filteredLogs, selectedPlayer, details, selectedStat]);

	const activeStatLabel = useMemo(() => {
		return (
			STAT_OPTIONS.find((opt) => opt.key === selectedStat)?.label || "Value"
		);
	}, [selectedStat]);

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Flower Failures Timeline
					</CardTitle>
					<CardDescription className="text-xs mt-1">
						Track flower consistency across pulls
					</CardDescription>
				</div>

				<div className="flex gap-2">
					<Select
						value={selectedStat}
						onValueChange={(val) =>
							setSelectedStat(val as keyof FlowerFailMatrix)
						}
					>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Select stat">
								{activeStatLabel}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{STAT_OPTIONS.map((opt) => (
								<SelectItem key={opt.key} value={opt.key}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{aggregatedPlayers.length > 0 && (
						<Select
							value={selectedPlayerName}
							onValueChange={(value) => setSelectedPlayerName(value ?? "")}
						>
							<SelectTrigger className="w-44 text-xs">
								<SelectValue placeholder="Select player">
									{selectedPlayer && (
										<PlayerOption
											name={selectedPlayer.primaryName}
											iconUrl={selectedPlayer.primaryIconUrl}
										/>
									)}
								</SelectValue>
							</SelectTrigger>

							<SelectContent>
								{aggregatedPlayers.map((p) => (
									<SelectItem key={p.account} value={p.primaryName}>
										<PlayerOption
											name={p.primaryName}
											iconUrl={p.primaryIconUrl}
										/>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
			</CardHeader>

			<CardContent className="pt-4">
				{chartData.length === 0 ? (
					<div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
						No data available.
					</div>
				) : (
					<ChartContainer config={CHART_CONFIG} className="h-64 w-full">
						<LineChart
							data={chartData}
							margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
							style={{ cursor: "pointer" }}
							// biome-ignore lint/suspicious/noExplicitAny: Recharts event payload typing is complex
							onClick={(e: any) => {
								if (e?.activeIndex !== undefined) {
									const idx = Number(e.activeIndex);
									if (!Number.isNaN(idx) && chartData[idx]) {
										const logId = chartData[idx].logId;
										window.open(`https://dps.report/${logId}`, "_blank");
									}
								}
							}}
						>
							<CartesianGrid
								vertical={false}
								strokeDasharray="3 3"
								className="stroke-muted"
							/>
							<XAxis dataKey="name" />
							<YAxis allowDecimals={false} domain={[0, "auto"]} />
							<ChartTooltip
								content={
									<ChartTooltipContent
										formatter={(value) => (
											<div className="flex items-center gap-2">
												<span className="text-muted-foreground">
													{activeStatLabel}:
												</span>
												<span className="font-semibold text-destructive">
													{value}
												</span>
											</div>
										)}
										labelFormatter={(_, payload) => {
											const data = payload?.[0]?.payload;
											return data?.fullDate || data?.name;
										}}
									/>
								}
							/>
							<Line
								type="monotone"
								dataKey="value"
								stroke="var(--destructive)"
								strokeWidth={2}
								dot={{
									r: 4,
									fill: "var(--background)",
									stroke: "var(--destructive)",
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: "var(--destructive)",
									stroke: "var(--background)",
									strokeWidth: 2,
								}}
							/>
						</LineChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
