import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricWidget } from "../../widgets/MetricWidget";
import type { PluginEncounterProps } from "../types";
import { CerusPhaseThresholdsCard } from "./CerusPhaseThresholdsCard";
import { DpsCheckTable } from "./DpsCheckTable";
import { FlowerBreakdownTable } from "./FlowerBreakdownTable";
import { FlowerFailGraph } from "./FlowerFailGraph";
import { FlowerFailTable } from "./FlowerFailTable";
import { MaliceFailTable } from "./MaliceFailTable";
import { OrbCollectDetails } from "./OrbCollectDetails";
import { PortalPerformanceTable } from "./PortalPerformanceTable";

export const CerusDetails = (props: PluginEncounterProps<25989>) => {
	const { metrics, filteredLogs } = props;

	return (
		<div className="flex flex-col items-start gap-6 w-full">
			<div className="flex flex-col lg:flex-row gap-4 w-full items-stretch">
				{/* First card: Fixed width sidebar */}
				<div className="w-full lg:w-[16.5rem] shrink-0">
					<CerusPhaseThresholdsCard filteredLogs={filteredLogs} />
				</div>

				{/* Metrics container: A dedicated grid that scales naturally */}
				<div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-stretch">
					{metrics.map((metric) => (
						<MetricWidget key={metric.id} metric={metric} {...props} />
					))}
				</div>
			</div>

			<div className="w-full">
				<PortalPerformanceTable {...props} />
			</div>

			<div className="w-full">
				<MaliceFailTable {...props} />
			</div>

			{/* 3. TABS: Heavy Data & 10-Player Tables */}
			<Tabs defaultValue="dps" className="w-full space-y-6">
				<TabsList>
					<TabsTrigger value="dps">50%-10% DPS Check</TabsTrigger>
					<TabsTrigger value="flower-stats">Flower Statistics</TabsTrigger>
					<TabsTrigger value="orb-collects">Orb Collects</TabsTrigger>
				</TabsList>

				<TabsContent value="dps" className="">
					<DpsCheckTable {...props} />
				</TabsContent>

				<TabsContent value="flower-stats" className="space-y-6">
					<FlowerFailTable {...props} />
					<FlowerBreakdownTable {...props} />
					<FlowerFailGraph {...props} />
				</TabsContent>

				<TabsContent value="orb-collects">
					<OrbCollectDetails {...props} />
				</TabsContent>
			</Tabs>
		</div>
	);
};
