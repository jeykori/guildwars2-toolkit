import type { LogSummary } from "../../../../../../types";
import { CERUS_CM_THRESHOLDS } from "../../../../../../utils/dps-report/plugins/cerus-cm/dps-check";
import { useToolkitComponents } from "../../../../../context";

interface Props {
	filteredLogs: LogSummary[];
}

export function CerusPhaseThresholdsCard({ filteredLogs }: Props) {
	const { Card, CardHeader, CardTitle, CardDescription, CardContent } =
		useToolkitComponents();

	// Determine mode based on the first available log
	const isLegendary = !!filteredLogs[0]?.isLegendaryCM;
	const isCM = !!filteredLogs[0]?.isCM;

	if (!isCM && !isLegendary) {
		return (
			<Card className="h-full flex flex-col" size="sm">
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Phase 3 DPS Requirements</CardTitle>
						<CardDescription className="text-xs mt-1">
							Not CM or LCM
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent>-</CardContent>
			</Card>
		);
	}

	const activeThresholds = isLegendary
		? CERUS_CM_THRESHOLDS.lcm
		: CERUS_CM_THRESHOLDS.cm;
	const modeName = isLegendary ? "Legendary CM" : "Challenge Mode";

	return (
		<Card className="flex flex-col" size="sm">
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Phase 3 DPS Requirements</CardTitle>
					<CardDescription className="text-xs mt-1">
						for {modeName}
					</CardDescription>
				</div>
				<div
					className={`text-xs font-bold px-2 py-1 rounded-md ${
						isLegendary
							? "bg-purple-500/20 text-purple-400"
							: "bg-red-500/20 text-red-400"
					}`}
				>
					{isLegendary ? "LCM" : "CM"}
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-2">
					{/* Orange / Lowest Threshold */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
							<span className="text-sm text-muted-foreground">
								Last Chance Phasing
							</span>
						</div>
						<span className="font-semibold">
							{activeThresholds.latePhase.toLocaleString()}
						</span>
					</div>

					{/* Yellow / Medium Threshold */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
							<span className="text-sm text-muted-foreground">
								2nd Green Phasing
							</span>
						</div>
						<span className="font-semibold">
							{activeThresholds.secondGreen.toLocaleString()}
						</span>
					</div>

					{/* Green / Best Threshold */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className="w-2.5 h-2.5 rounded-full bg-green-500" />
							<span className="text-sm text-muted-foreground">
								Green Phasing
							</span>
						</div>
						<span className="font-semibold">
							{activeThresholds.firstGreen.toLocaleString()}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
