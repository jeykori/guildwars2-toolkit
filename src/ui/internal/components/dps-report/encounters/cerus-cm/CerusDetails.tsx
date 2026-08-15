import { useMemo } from "react";
import { CERUS_CM_PLUGIN_ID } from "../../../../../../utils/dps-report/plugins/cerus-cm/dps-check";
import { ScalarMetricWidget } from "../../widgets/ScalarMetricWidget";
import type { PluginEncounterProps } from "../types";
import { CerusPhaseThresholdsCard } from "./CerusPhaseThresholdsCard";
import { FlowerFailGraph } from "./FlowerFailGraph";
import { FlowerFailTable } from "./FlowerFailTable";

export const CerusDetails = (props: PluginEncounterProps<25989>) => {
	const { metrics, aggregatedSquadMetrics, filteredLogs } = props;

	const dpsMetric = useMemo(() => {
		const metric = metrics.find((m) => m.id === CERUS_CM_PLUGIN_ID);

		if (metric?.displayType !== "SCALAR") {
			return null;
		}

		return metric;
	}, [metrics]);

	return (
		<div className="flex flex-col items-start gap-6 w-full">
			<div className="flex flex-col sm:flex-row items-stretch gap-6 w-full">
				<div className="w-full sm:w-72">
					<CerusPhaseThresholdsCard filteredLogs={filteredLogs} />
				</div>

				{dpsMetric && (
					<div className="w-full sm:w-60">
						<ScalarMetricWidget
							metric={dpsMetric}
							value={
								aggregatedSquadMetrics[dpsMetric.id] ?? {
									dataType: "scalar",
									value: -1, // shouldn't happen
								}
							}
							filteredLogs={filteredLogs}
						/>
					</div>
				)}
			</div>

			<div className="w-full">
				<FlowerFailTable {...props} />
			</div>

			<div className="w-full overflow-hidden">
				<FlowerFailGraph {...props} />
			</div>
		</div>
	);
};
