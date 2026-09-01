import type { DpsReportJson } from "../../../../../types/dps-report";
import { getEuclideanDist, getPlayerPosition } from "../../../utils";
import type { CerusEncounterContext, CerusPhase, PortalEvent } from "../types";
import { FLOWER_STRAT_PORTALS } from "./flower-portals";
import type { CerusMechanic, RawPortalCast } from "./types";

const SKILLS = {
	PORTAL_ENTRE: 10197,
	PORTAL_EXEUNT: 10199,
	SAND_SWELL: 42917,
};

export function getValidPortal(
	context: CerusEncounterContext,
	expectedId: string,
	mechanicType: CerusMechanic,
): PortalEvent | undefined {
	const expected = FLOWER_STRAT_PORTALS.find((s) => s.id === expectedId);
	const requirement = expected?.mechanicRequirements.find(
		(r) => r.mechanic === mechanicType,
	);

	if (!expected || !requirement) return undefined;

	const phaseStart = context.phaseStarts[expected.phase];
	if (phaseStart === undefined) return undefined;

	const minOpenMs = phaseStart + requirement.validOpenWindow[0] * 1000;
	const maxOpenMs = phaseStart + requirement.validOpenWindow[1] * 1000;

	// 4. Find and validate the portal
	return context.portals.find(
		(p) =>
			p.id === expectedId && p.openTime >= minOpenMs && p.openTime <= maxOpenMs,
	);
}

export function buildEncounterContext(
	logData: DpsReportJson,
): CerusEncounterContext {
	const scale = logData.combatReplayMetaData.inchToPixel;

	// 1. Get absolute phase start times
	const phaseStarts: Partial<Record<CerusPhase, number>> = {
		"Phase 1": logData.phases.find((p) => p.name === "Phase 1")?.start,
		"Phase 2": logData.phases.find((p) => p.name === "Phase 2")?.start,
		"Phase 3": logData.phases.find((p) => p.name === "Phase 3")?.start,
		"Enraged Smash": logData.phases.find((p) => p.name === "Enraged Smash")
			?.start,
	};

	// 2. Extract every physical portal cast from the log
	const rawPortals = extractAllRawPortals(logData);

	// 3. Match raw casts to our strategy blueprint
	const matchedPortals: PortalEvent[] = [];

	for (const expected of FLOWER_STRAT_PORTALS) {
		const phaseStart = phaseStarts[expected.phase];
		if (phaseStart === undefined) continue;

		const expectedOpenMs = phaseStart + expected.openTime * 1000;
		const windowStartMs = expectedOpenMs - expected.openWindow * 1000;
		const windowEndMs = expectedOpenMs + expected.openWindow * 1000;

		// Iterate through raw portals to find the first match
		for (const raw of rawPortals) {
			// Must be the right type and fall within the expected time window
			if (
				raw.type !== expected.type ||
				raw.openTime < windowStartMs ||
				raw.openTime > windowEndMs
			) {
				continue;
			}

			const p1NearFrom =
				getEuclideanDist(raw.pos1, expected.from.location) <=
				expected.from.radius * scale;
			const p2NearFrom =
				getEuclideanDist(raw.pos2, expected.from.location) <=
				expected.from.radius * scale;

			const checkOther = (
				otherPos: readonly [number, number],
				fromPos: readonly [number, number],
			) => {
				const { to: expectedTo, minDistance } = expected;
				if (expectedTo) {
					return expectedTo.location.some(
						(target) =>
							getEuclideanDist(otherPos, target) <= expectedTo.radius * scale,
					);
				}
				if (minDistance) {
					return getEuclideanDist(otherPos, fromPos) >= minDistance * scale;
				}
				return true;
			};

			let locationFrom: readonly [number, number] | null = null;
			let locationTo: readonly [number, number] | null = null;

			// Scenario A: pos1 is the origin, pos2 is the destination
			if (p1NearFrom && checkOther(raw.pos2, raw.pos1)) {
				locationFrom = raw.pos1;
				locationTo = raw.pos2;
			}
			// Scenario B: pos2 is the origin, pos1 is the destination
			else if (p2NearFrom && checkOther(raw.pos1, raw.pos2)) {
				locationFrom = raw.pos2;
				locationTo = raw.pos1;
			}

			// If either scenario matched, push the result and break
			if (locationFrom && locationTo) {
				matchedPortals.push({
					id: expected.id,
					caster: raw.caster,
					type: raw.type,
					openTime: raw.openTime,
					closeTime: raw.closeTime,
					locationFrom,
					locationTo,
				});
				break; // Match found, move to the next expected portal
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
			maker.rotation?.find((r) => r.id === SKILLS.PORTAL_EXEUNT)?.skills || [];
		const entres =
			maker.rotation?.find((r) => r.id === SKILLS.PORTAL_ENTRE)?.skills || [];

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
			maker.rotation?.find((r) => r.id === SKILLS.SAND_SWELL)?.skills || [];

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
