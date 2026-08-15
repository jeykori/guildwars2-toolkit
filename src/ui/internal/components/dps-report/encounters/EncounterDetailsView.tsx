import { CerusDetails } from "./cerus-cm/CerusDetails";
import type { CommonEncounterProps } from "./types";

export const EncounterDetailsView = (props: CommonEncounterProps) => {
	const { encounterDetailStates, ...restProps } = props;

	switch (encounterDetailStates.triggerId) {
		case 25989:
			return (
				<CerusDetails
					{...restProps}
					encounterDetailStates={encounterDetailStates}
				/>
			);

		default:
			return null;
	}
};
