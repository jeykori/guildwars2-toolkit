import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricWidget } from "../../widgets/MetricWidget";
import type { PluginEncounterProps } from "../types";
import { CerusPhaseThresholdsCard } from "./CerusPhaseThresholdsCard";
import { DpsCheckTable } from "./DpsCheckTable";
import { FlowerBreakdownTable } from "./FlowerBreakdownTable";
import { FlowerFailGraph } from "./FlowerFailGraph";
import { FlowerFailTable } from "./FlowerFailTable";
import { InsatiableHungerTable } from "./InsatiableHungerTable";
import { MaliceFailTable } from "./MaliceFailTable";
import { PortalPerformanceTable } from "./PortalPerformanceTable";

export const CerusDetails = (props: PluginEncounterProps<25989>) => {
	const { metrics, filteredLogs } = props;

	return (
		<div className="flex flex-col items-start gap-6 w-full">
			<div className="flex flex-wrap gap-4 w-full items-stretch">
				{/* First card: Fixed width, no shrink */}
				<div className="w-full sm:w-72 shrink-0">
					<CerusPhaseThresholdsCard filteredLogs={filteredLogs} />
				</div>

				{metrics.map((metric) => (
					<div
						key={metric.id}
						className="flex-1 min-w-46.25 max-w-full sm:max-w-65"
					>
						<MetricWidget metric={metric} {...props} />
					</div>
				))}
			</div>

			<div className="w-full">
				<PortalPerformanceTable {...props} />
			</div>

			<div className="w-full">
				<InsatiableHungerTable {...props} />
			</div>

			<div className="w-full">
				<MaliceFailTable {...props} />
			</div>

			{/* 3. TABS: Heavy Data & 10-Player Tables */}
			<Tabs defaultValue="dps" className="w-full space-y-6">
				<TabsList>
					<TabsTrigger value="dps">50%-10% DPS Check</TabsTrigger>
					<TabsTrigger value="flower-stats">Flower Statistics</TabsTrigger>
				</TabsList>

				<TabsContent value="dps" className="">
					<DpsCheckTable {...props} />
				</TabsContent>

				<TabsContent value="flower-stats" className="space-y-6">
					<FlowerFailTable {...props} />
					<FlowerBreakdownTable {...props} />
					<FlowerFailGraph {...props} />
				</TabsContent>
			</Tabs>
		</div>
	);
};
