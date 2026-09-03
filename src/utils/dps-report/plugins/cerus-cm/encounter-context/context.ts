import type { DpsReportJson } from "../../../../../types/dps-report";
import { getEuclideanDist, getPlayerPosition } from "../../../utils";
import type { CerusEncounterContext, CerusPhase, PortalEvent } from "../types";
import {
	CERUS_MECHANIC_TIMINGS,
	FLOWER_PORTAL_SKILLS,
	PORTAL_LIFESPANS,
} from "./constants";
import { FLOWER_STRAT_PORTALS } from "./flower-portals";
import type { CerusMechanic, RawPortalCast } from "./types";

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

const getMechanicConfig = (mechanic: CerusMechanic) => {
	switch (mechanic) {
		case "malice":
			return CERUS_MECHANIC_TIMINGS.malice;
		case "flower":
			return CERUS_MECHANIC_TIMINGS.despair;
		case "rage":
		case "bad-collect":
			return CERUS_MECHANIC_TIMINGS.rage;
	}
};

export function buildEncounterContext(
	logData: DpsReportJson,
): CerusEncounterContext {
	const scale = logData.combatReplayMetaData?.inchToPixel ?? 1;
	const MECHANIC_SEARCH_WINDOW = 3000; // 3 seconds
	const PORTAL_SEARCH_WINDOW = 5000; // 5 seconds
	/**
	 * Portal Buffers
	 * Default: open 1 second before hit, stay open 1 second after hit
	 */
	const DEFAULT_BUFFERS = {
		before: 1,
		after: 1,
	};

	const phaseStarts: Partial<Record<CerusPhase | string, number>> = {};
	logData.phases.forEach((p) => {
		phaseStarts[p.name] = p.start;
	});

	const rawPortals = extractAllRawPortals(logData);
	const matchedPortals: PortalEvent[] = [];

	for (const expected of FLOWER_STRAT_PORTALS) {
		const phaseStart = phaseStarts[expected.phase];
		if (phaseStart === undefined) continue;

		// A. Resolve Mechanics Math
		const resolvedMechanics: PortalEvent["mechanics"] = [];

		for (const req of expected.mechanicRequirements) {
			const expectedCastMs = phaseStart + req.expectedCastTime * 1000;

			const mechanicConfig = getMechanicConfig(req.mechanic);
			const castName = mechanicConfig.events.cast;
			const castToHitDuration = mechanicConfig.durations.castToHit;

			const casts =
				logData.mechanics.find((m) => m.name === castName)?.mechanicsData || [];
			const actualCast = casts.find(
				(c) => Math.abs(c.time - expectedCastMs) <= MECHANIC_SEARCH_WINDOW,
			);

			const finalCastMs = actualCast?.time ?? expectedCastMs;
			const expectedHitTime = finalCastMs + castToHitDuration;

			const lifespanMs = PORTAL_LIFESPANS[expected.type];

			const bufferBefore =
				(req.bufferBeforeHit ?? DEFAULT_BUFFERS.before) * 1000;
			const bufferAfter = (req.bufferAfterHit ?? DEFAULT_BUFFERS.after) * 1000;

			const latestOpen = expectedHitTime - bufferBefore;
			const earliestOpen = expectedHitTime - lifespanMs + bufferAfter;

			resolvedMechanics.push({
				mechanic: req.mechanic,
				expectedHitTime,
				validOpenWindow: [earliestOpen, latestOpen],
			});
		}

		// B. Find the matching physical cast using the general search window
		const expectedOpenMs = phaseStart + expected.openTime * 1000;
		const windowStartMs = expectedOpenMs - PORTAL_SEARCH_WINDOW;
		const windowEndMs = expectedOpenMs + PORTAL_SEARCH_WINDOW;

		for (const raw of rawPortals) {
			if (
				raw.type !== expected.type ||
				raw.openTime < windowStartMs ||
				raw.openTime > windowEndMs
			) {
				continue;
			}

			// Calculate distances for the 'from' check
			const distP1From = getEuclideanDist(raw.pos1, expected.from.location);
			const distP2From = getEuclideanDist(raw.pos2, expected.from.location);

			const p1NearFrom =
				distP1From <= expected.from.radius * scale &&
				(!expected.from.innerRadius ||
					distP1From >= expected.from.innerRadius * scale);

			const p2NearFrom =
				distP2From <= expected.from.radius * scale &&
				(!expected.from.innerRadius ||
					distP2From >= expected.from.innerRadius * scale);

			// Validate 'to' logic
			const checkOther = (
				otherPos: readonly [number, number],
				fromPos: readonly [number, number],
			) => {
				const { to: expectedTo, minDistance } = expected;

				if (expectedTo) {
					return expectedTo.location.some((target) => {
						const dist = getEuclideanDist(otherPos, target);
						return (
							dist <= expectedTo.radius * scale &&
							(!expectedTo.innerRadius ||
								dist >= expectedTo.innerRadius * scale)
						);
					});
				}

				if (minDistance) {
					return getEuclideanDist(otherPos, fromPos) >= minDistance * scale;
				}

				return true;
			};

			let locationFrom: readonly [number, number] | null = null;
			let locationTo: readonly [number, number] | null = null;

			if (p1NearFrom && checkOther(raw.pos2, raw.pos1)) {
				locationFrom = raw.pos1;
				locationTo = raw.pos2;
			} else if (p2NearFrom && checkOther(raw.pos1, raw.pos2)) {
				locationFrom = raw.pos2;
				locationTo = raw.pos1;
			}

			if (locationFrom && locationTo) {
				matchedPortals.push({
					id: expected.id,
					caster: raw.caster,
					type: raw.type,
					openTime: raw.openTime,
					closeTime: raw.closeTime,
					locationFrom,
					locationTo,
					mechanics: resolvedMechanics,
				});
				break;
			}
		}
	}

	return { phaseStarts, portals: matchedPortals };
}

function extractAllRawPortals(logData: DpsReportJson): RawPortalCast[] {
	const rawPortals: RawPortalCast[] = [];

	// --- CHRONO PORTALS ---
	const mesmers = logData.players.filter((p) =>
		["Mesmer", "Chronomancer", "Mirage", "Virtuoso", "Troubadour"].includes(
			p.profession,
		),
	);

	for (const maker of mesmers) {
		const exeunts =
			maker.rotation?.find((r) => r.id === FLOWER_PORTAL_SKILLS.PORTAL_EXEUNT)
				?.skills || [];
		const entres =
			maker.rotation?.find((r) => r.id === FLOWER_PORTAL_SKILLS.PORTAL_ENTRE)
				?.skills || [];

		for (const exeunt of exeunts) {
			const entre = entres.filter((c) => c.castTime <= exeunt.castTime).at(-1);

			if (entre) {
				const pos1 = getPlayerPosition(maker.name, entre.castTime, logData);
				const pos2 = getPlayerPosition(maker.name, exeunt.castTime, logData);

				if (pos1 && pos2) {
					const openTime = exeunt.castTime + (exeunt.duration || 0);
					rawPortals.push({
						caster: maker.name,
						type: "chrono",
						openTime,
						closeTime: openTime + 10000, // Chrono port lasts 10s
						pos1,
						pos2,
					});
				}
			}
		}
	}

	// --- SCOURGE PORTALS ---
	const necros = logData.players.filter((p) =>
		p.profession.includes("Scourge"),
	);

	for (const maker of necros) {
		const swells =
			maker.rotation?.find((r) => r.id === FLOWER_PORTAL_SKILLS.SAND_SWELL)
				?.skills || [];

		for (const swell of swells) {
			const openTime = swell.castTime + (swell.duration || 0);

			const pos1 = getPlayerPosition(maker.name, swell.castTime, logData);
			const pos2 = getPlayerPosition(maker.name, openTime, logData);

			if (pos1 && pos2) {
				rawPortals.push({
					caster: maker.name,
					type: "scourge",
					openTime,
					closeTime: openTime + 8000, // Scourge port lasts 8s
					pos1,
					pos2,
				});
			}
		}
	}

	return rawPortals;
}
