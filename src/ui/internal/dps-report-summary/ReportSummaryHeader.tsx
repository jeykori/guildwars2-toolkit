import { useToolkitComponents } from "../../context";
import { formatMs } from "../utils/format";

interface ReportSummaryHeaderProps {
	overview: {
		fights: Array<{ name: string; iconUrl: string }>;
		logCount: number;
		successCount: number;
		totalDurationMs: number;
		startTime: string;
		endTime: string;
	};
}

export function ReportSummaryHeader({ overview }: ReportSummaryHeaderProps) {
	const { Card, CardHeader, CardTitle, CardDescription, Badge } =
		useToolkitComponents();
	return (
		<Card>
			<CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
				<div className="space-y-4 flex-1">
					<CardTitle className="text-2xl font-bold">
						{overview.fights.map((f) => f.name).join(", ")}
					</CardTitle>

					<CardDescription>
						{/* General Stats Section */}
						<div className="flex gap-6 flex-wrap">
							<p>
								Logs Parsed:{" "}
								<span className="text-foreground font-medium">
									{overview.logCount}
								</span>
							</p>
							<p>
								Successes:{" "}
								<span className="text-foreground font-medium">
									{overview.successCount} / {overview.logCount}
								</span>
							</p>
						</div>
						{/* Session Timeline Section */}
						<div className="text-xs">
							<span className="truncate">
								Session:{" "}
								<span className="font-medium text-foreground">
									{new Intl.DateTimeFormat(undefined, {
										dateStyle: "medium",
										timeStyle: "short",
									}).format(new Date(overview.startTime))}
								</span>
								<span className="mx-1.5 text-muted-foreground">→</span>
								<span className="font-medium text-foreground">
									{new Intl.DateTimeFormat(undefined, {
										dateStyle: "medium",
										timeStyle: "short",
									}).format(new Date(overview.endTime))}
								</span>
							</span>
							<Badge variant="outline" className="mx-1.5">
								{formatMs(
									new Date(overview.endTime).getTime() -
										new Date(overview.startTime).getTime(),
								)}
							</Badge>
						</div>
					</CardDescription>
				</div>

				<div className="flex items-center gap-2 flex-wrap shrink-0">
					{overview.fights.map((fight) => (
						<img
							key={fight.name}
							src={fight.iconUrl}
							alt={fight.name}
							title={fight.name}
							className="w-24 h-24 rounded-md object-cover border bg-muted"
						/>
					))}
				</div>
			</CardHeader>
		</Card>
	);
}
