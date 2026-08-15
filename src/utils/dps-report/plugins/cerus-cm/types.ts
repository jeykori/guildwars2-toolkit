import type { EncounterPlugin } from "../../../../types";
import type {
	AggregatedFlowerFailures,
	FlowerFailures,
} from "./flower-failures/types";

export type CerusLogDetails = {
	flowerFailures?: FlowerFailures;
};

export type CerusAggregatedDetails = {
	flowerFailures?: AggregatedFlowerFailures;
};

export type CerusPlugin = EncounterPlugin<
	CerusLogDetails,
	CerusAggregatedDetails
>;
