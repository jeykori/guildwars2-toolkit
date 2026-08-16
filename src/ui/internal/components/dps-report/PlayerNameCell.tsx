import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AggregatedPlayer } from "../../../../types";

type PlayerNameCellProps = {
	// We use Pick so you can use this component even if you don't have a full AggregatedPlayer object
	player: Pick<
		AggregatedPlayer,
		"primaryName" | "primaryIconUrl" | "characters"
	>;
};

export function PlayerNameCell({ player }: PlayerNameCellProps) {
	return (
		<Tooltip>
			<TooltipTrigger>
				<div className="flex items-center gap-1.5 w-max cursor-text">
					{player.primaryIconUrl && (
						<img
							src={player.primaryIconUrl}
							alt={player.primaryName}
							className="w-4 h-4 rounded-sm" // Note: w-4.5 is not standard Tailwind, rounded to 4 (16px) or 5 (20px)
						/>
					)}
					<span className="whitespace-nowrap">{player.primaryName}</span>
				</div>
			</TooltipTrigger>

			{/* w-max forces the tooltip to shrink-wrap its contents perfectly */}
			<TooltipContent className="p-1.5 w-max">
				<div className="space-y-1">
					{player.characters.map((char) => (
						<div
							key={char.name}
							className="flex items-center gap-1 whitespace-nowrap"
						>
							{char.iconUrl && (
								<img
									src={char.iconUrl}
									alt={char.profession}
									className="w-4 h-4 rounded-sm"
								/>
							)}
							<span>{char.name}</span>
						</div>
					))}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
