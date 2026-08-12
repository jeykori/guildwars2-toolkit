import { useToolkitComponents } from "../../../context";

type SortableHeaderProps = {
	label: string;
	sortKey: string;
	requestSort: (key: string) => void;
	sortConfig: { key: string; direction: "asc" | "desc" } | null;
	align?: "left" | "right";
	className?: string;
	title?: string;
};

export function SortableHeader({
	label,
	sortKey,
	requestSort,
	sortConfig,
	align = "right",
	className = "",
	title,
}: SortableHeaderProps) {
	const { TableHead } = useToolkitComponents();

	return (
		<TableHead
			className={`cursor-pointer hover:bg-accent transition-colors select-none relative group ${className}`}
			onClick={() => requestSort(sortKey)}
		>
			<div
				className={`flex items-center gap-1 ${
					align === "right" ? "justify-end" : "justify-start"
				}`}
			>
				<span className="truncate">{label}</span>
				<span className="flex-shrink-0 flex justify-center w-3 text-primary">
					{sortConfig?.key === sortKey &&
						(sortConfig.direction === "asc" ? "↑" : "↓")}
				</span>
			</div>

			{title && (
				<div className="absolute top-full right-0 mt-2 w-max max-w-xs invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all z-50 bg-popover text-popover-foreground text-xs rounded-md py-2 px-3 pointer-events-none shadow-xl border font-normal text-left whitespace-normal">
					{title}
					<div className="absolute bottom-full right-6 border-4 border-transparent border-b-popover"></div>
				</div>
			)}
		</TableHead>
	);
}
