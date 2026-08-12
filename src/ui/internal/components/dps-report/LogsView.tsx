import type { LogSummary } from "../../../../types";
import { useToolkitComponents } from "../../../context";
import { useSortableData } from "../../hooks/useSortableData";
import { formatMs } from "../../utils/format";
import { SortableHeader } from "../shared/SortableHeader";

type LogsViewProps = {
	logs: LogSummary[];
};

export function LogsView({ logs }: LogsViewProps) {
	const { Table, TableBody, TableCell, TableHeader, TableRow, buttonVariants } =
		useToolkitComponents();

	const {
		items: sortedLogs,
		requestSort,
		sortConfig,
	} = useSortableData(logs, "startTime");
	const sortableProps = { requestSort, sortConfig };

	return (
		<div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow>
						<SortableHeader
							label="Recorded By"
							sortKey="recordedBy"
							align="left"
							{...sortableProps}
						/>
						<SortableHeader
							label="Start Time"
							sortKey="startTime"
							align="left"
							{...sortableProps}
						/>
						<SortableHeader
							label="End Time"
							sortKey="endTime"
							align="left"
							{...sortableProps}
						/>
						<SortableHeader
							label="Duration"
							sortKey="durationMs"
							{...sortableProps}
						/>
						<SortableHeader
							label="Report Link"
							sortKey="id"
							align="right"
							{...sortableProps}
						/>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sortedLogs.map((log) => {
						const logUrl = `https://dps.report/${log.id}`; // Built using native dps.report url convention
						return (
							<TableRow
								key={log.id}
								onClick={() => window.open(logUrl, "_blank")}
								className="odd:bg-row-alt odd:hover:bg-accent cursor-pointer group transition-colors"
							>
								<TableCell className="font-medium">{log.recordedBy}</TableCell>
								<TableCell className="text-muted-foreground">
									{new Intl.DateTimeFormat(undefined, {
										dateStyle: "medium",
										timeStyle: "medium",
									}).format(new Date(log.startTime))}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{new Intl.DateTimeFormat(undefined, {
										dateStyle: "medium",
										timeStyle: "medium",
									}).format(new Date(log.endTime))}
								</TableCell>
								<TableCell className="text-right">
									{formatMs(log.durationMs)}
								</TableCell>
								<TableCell className="text-right">
									<a
										href={logUrl}
										target="_blank"
										rel="noopener noreferrer"
										className={buttonVariants({
											variant: "link",
											size: "xs",
											className: "group-hover:underline transition-colors",
										})}
										onClick={(e) => e.stopPropagation()}
									>
										View Log ↗
									</a>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
