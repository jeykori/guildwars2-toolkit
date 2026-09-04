import type {
	DpsReportJson,
	EncounterPlugin,
} from "../../../../../types/dps-report";
import type { CerusEncounterContext, CerusPhase, PortalEvent } from "../types";
import { FLOWER_STRAT_PORTALS } from "./flower-portals";
import { getPortalContext } from "./portal-context";
import { getRoleContext } from "./role-context";
import type { CerusMechanic } from "./types";

export type PortalValidationResult =
	| { isValid: true; portal: PortalEvent }
	| { isValid: false; missedMechanics: CerusMechanic[] };

export function getValidPortal(
	context: CerusEncounterContext,
	expectedId: string,
	mechanicTypes?: CerusMechanic[],
): PortalValidationResult {
	// 1. Resolve which mechanics we are actually checking
	let mechanicsToCheck = mechanicTypes;

	// If not explicitly provided, look up the blueprint to see what it originally required
	if (!mechanicsToCheck) {
		const blueprint = FLOWER_STRAT_PORTALS.find((p) => p.id === expectedId);
		mechanicsToCheck = blueprint
			? blueprint.mechanicRequirements.map((r) => r.mechanic)
			: [];
	}

	// 2. Find the physical portal that was cast
	const portal = context.portals.find((p) => p.id === expectedId);

	// If the portal wasn't placed correctly or is completely missing
	if (!portal) {
		return {
			isValid: false,
			missedMechanics: mechanicsToCheck,
		};
	}

	// 3. Filter the portal's attached mechanics down to just the ones we want to validate
	const missedMechanics: CerusMechanic[] = [];
	const mechanicsToValidate = portal.mechanics.filter((m) =>
		mechanicsToCheck.includes(m.mechanic),
	);

	// 4. Validate strict windows for those mechanics
	for (const req of mechanicsToValidate) {
		const [minOpenMs, maxOpenMs] = req.validOpenWindow;

		const isSuccess =
			portal.openTime >= minOpenMs && portal.openTime <= maxOpenMs;

		if (!isSuccess) {
			missedMechanics.push(req.mechanic);
		}
	}

	// 5. Return Discriminated Result
	if (missedMechanics.length > 0) {
		return { isValid: false, missedMechanics };
	}

	return { isValid: true, portal };
}

export function buildEncounterContext(
	logData: DpsReportJson,
	mapped: Parameters<EncounterPlugin["parseLog"]>[2],
): CerusEncounterContext {
	const phaseStarts: Partial<Record<CerusPhase | string, number>> = {};
	logData.phases.forEach((p) => {
		phaseStarts[p.name] = p.start;
	});

	const portals = getPortalContext(logData);
	const roles = getRoleContext(logData, mapped);

	return {
		phaseStarts,
		roles,
		portals,
	};
}
