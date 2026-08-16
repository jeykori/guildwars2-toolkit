import { TableHead } from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type SortableHeaderProps = {
	label: string;
	sortKey: string;
	requestSort: (key: string) => void;
	sortConfig: { key: string; direction: "asc" | "desc" } | null;
	align?: "left" | "right";
	className?: string;
	title?: string;
	overlapIcon?: boolean;
};

export function SortableHeader({
	label,
	sortKey,
	requestSort,
	sortConfig,
	align = "right",
	className = "",
	title,
	overlapIcon = false,
}: SortableHeaderProps) {
	const innerContent = (
		<div
			className={`relative flex items-center w-full ${overlapIcon ? "" : "gap-1"} ${
				align === "right" ? "justify-end" : "justify-start"
			}`}
		>
			<span className="truncate">{label}</span>
			<span
				className={`shrink-0 flex justify-center w-3 text-primary ${
					overlapIcon ? "absolute left-full ml-1" : ""
				}`}
			>
				{sortConfig?.key === sortKey &&
					(sortConfig.direction === "asc" ? "↑" : "↓")}
			</span>
		</div>
	);

	return (
		<TableHead
			className={`cursor-pointer hover:bg-accent transition-colors select-none ${className}`}
			onClick={() => requestSort(sortKey)}
		>
			{title ? (
				<Tooltip>
					<TooltipTrigger className="w-full text-inherit flex">
						{innerContent}
					</TooltipTrigger>
					<TooltipContent
						side="top"
						className="font-normal text-left whitespace-normal"
					>
						{title}
					</TooltipContent>
				</Tooltip>
			) : (
				innerContent
			)}
		</TableHead>
	);
}
