import type { DpsReportJson } from "../../../../../../types";
import {
	CERUS_MECHANIC_TIMINGS,
	FLOWER_PORTAL_SKILLS,
} from "../../encounter-context/constants";
import { getValidPortal } from "../../encounter-context/context";
import { FLOWER_STRAT_PORTALS } from "../../encounter-context/flower-portals";
import type {
	CerusMechanic,
	FlowerPortalId,
} from "../../encounter-context/types";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../../types";
import type { PortalPerformance } from "./types";

// Helper to quickly grab the duration for the hit time check
const MECHANIC_DURATIONS: Record<CerusMechanic, number> = {
	malice: CERUS_MECHANIC_TIMINGS.malice.durations.castToHit,
	rage: CERUS_MECHANIC_TIMINGS.rage.durations.castToHit,
	flower: CERUS_MECHANIC_TIMINGS.despair.durations.castToHit,
	"bad-collect": CERUS_MECHANIC_TIMINGS.rage.durations.castToHit,
};

/**
 * Evaluates if a portal is forgiven due to the group phasing the boss early.
 * A portal is forgiven if the EARLIEST mechanic it serves hits at or after the phase ends.
 */
function isPortalForgiven(
	expected: (typeof FLOWER_STRAT_PORTALS)[number],
	currentPhase: DpsReportJson["phases"][0],
	allPhases: DpsReportJson["phases"],
): boolean {
	// 1. Determine the effective end of the phase
	let endOfPhaseMs = currentPhase.end;

	if (expected.phasePushForgiveness) {
		const pushPhase = allPhases.find(
			(p) => p.name === expected.phasePushForgiveness,
		);
		if (pushPhase) {
			endOfPhaseMs = pushPhase.start;
		}
	}

	if (expected.mechanicRequirements.length === 0) {
		return false;
	}

	// 2. Find the earliest hit time among all mechanics this portal is supposed to handle
	const earliestHitTimeMs = Math.min(
		...expected.mechanicRequirements.map((req) => {
			return (
				currentPhase.start +
				req.expectedCastTime * 1000 +
				MECHANIC_DURATIONS[req.mechanic]
			);
		}),
	);

	// 3. If the first mechanic hits at or after the phase effectively ended, the portal is forgiven
	return earliestHitTimeMs >= endOfPhaseMs;
}

export const parsePortalPerformanceMetric: CerusSubParser = (
	report,
	_combatReplay,
	mapped,
	context,
) => {
	mapped.encounterDetails ??= {};
	mapped.encounterDetails.portalPerformance ??= {};
	const performance = mapped.encounterDetails.portalPerformance;

	const getDesignatedPlayer = (type: "chrono" | "scourge") => {
		const isTargetProfession = (p: DpsReportJson["players"][0]) =>
			type === "chrono"
				? [
						"Mesmer",
						"Chronomancer",
						"Mirage",
						"Virtuoso",
						"Troubadour",
					].includes(p.profession)
				: p.profession.includes("Scourge");

		const player = report.players.find(
			(p) =>
				isTargetProfession(p) &&
				p.rotation?.some((r) => {
					return Object.values(FLOWER_PORTAL_SKILLS).includes(r.id);
				}),
		);

		return player?.account;
	};

	for (const expected of FLOWER_STRAT_PORTALS) {
		const phase = report.phases.find((p) => p.name === expected.phase);
		if (!phase) continue;
		// 1. Phase-Push Forgiveness Check
		if (isPortalForgiven(expected, phase, report.phases)) {
			continue; // Group phased early, portal is forgiven.
		}

		// 2. Find the designated player
		const account = getDesignatedPlayer(expected.type);
		if (!account) {
			continue; // No designated player found in log
		}

		// 3. Initialize player stats
		let playerStats = performance[account];
		if (!playerStats) {
			playerStats = {
				role: expected.type,
				totalExpected: 0,
				totalSuccessful: 0,
				portals: {},
			};
			performance[account] = playerStats;
		}

		const portalId = expected.id as FlowerPortalId;
		playerStats.portals[portalId] ??= {
			expected: 0,
			successful: 0,
			missedMechanics: [],
		};
		const pStat = playerStats.portals[portalId];

		// 4. Grade the Portal
		playerStats.totalExpected += 1;
		pStat.expected += 1;

		// Extract the mechanics required by this specific blueprint
		const expectedMechanics = expected.mechanicRequirements.map(
			(r) => r.mechanic,
		);

		// Evaluate the portal using the discriminated union
		const validation = getValidPortal(context, expected.id, expectedMechanics);

		if (validation.isValid) {
			playerStats.totalSuccessful += 1;
			pStat.successful += 1;
		} else {
			// Because we passed expectedMechanics to getValidPortal, it inherently
			// knows what was missed whether the portal was cast poorly OR completely missing.
			pStat.missedMechanics.push(...validation.missedMechanics);
		}
	}

	return mapped;
};

export const aggregatePortalPerformance: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
) => {
	const combinedPerformance: PortalPerformance = {};

	for (const log of logs) {
		const logPerformance = (log.encounterDetails as CerusLogDetails)
			?.portalPerformance;
		if (!logPerformance) continue;

		for (const [account, metrics] of Object.entries(logPerformance)) {
			let target = combinedPerformance[account];
			if (!target) {
				target = {
					role: metrics.role,
					totalExpected: 0,
					totalSuccessful: 0,
					portals: {},
				};
				combinedPerformance[account] = target;
			}

			target.totalExpected += metrics.totalExpected;
			target.totalSuccessful += metrics.totalSuccessful;

			// Deep merge the specific portals
			for (const [portalId, stat] of Object.entries(metrics.portals)) {
				const id = portalId as FlowerPortalId;
				target.portals[id] ??= {
					expected: 0,
					successful: 0,
					missedMechanics: [],
				};

				target.portals[id].expected += stat.expected;
				target.portals[id].successful += stat.successful;
				target.portals[id].missedMechanics.push(...stat.missedMechanics);
			}
		}
	}

	return { portalPerformance: combinedPerformance };
};
