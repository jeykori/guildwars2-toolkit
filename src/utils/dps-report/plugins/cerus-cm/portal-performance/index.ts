import type { DpsReportJson } from "../../../../../types";
import { FLOWER_PORTAL_SKILLS } from "../encounter-context/constants";
import { FLOWER_STRAT_PORTALS } from "../encounter-context/flower-portals";
import type { FlowerPortalId } from "../encounter-context/types";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../types";
import type { PortalPerformance } from "./types";

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
		const { phasePushForgiveness } = expected;
		// Determine the required cutoff threshold in milliseconds
		const cutoffTime = phasePushForgiveness?.time ?? expected.openTime;
		const cutoffMs = cutoffTime * 1000;

		// Determine when the phase "ended" for the purpose of this mechanic
		let endOfPhaseMs = phase.end;

		if (phasePushForgiveness?.ccPhase) {
			// Look for the specified CC phase in the log
			const ccPhase = report.phases.find(
				(p) => p.name === phasePushForgiveness.ccPhase,
			);

			if (ccPhase) {
				// If it happened, the mechanic was skipped the moment the CC phase started
				endOfPhaseMs = ccPhase.start;
			}
		}

		// Calculate how long the phase lasted up until the "end" (either push or CC bar)
		const effectivePhaseDurationMs = endOfPhaseMs - phase.start;

		// If the group pushed the phase faster than the cutoff time, forgive and skip
		if (effectivePhaseDurationMs < cutoffMs) {
			continue; // Skip evaluating this portal/mechanic
		}

		// 2. Find the portal & designated player
		const physicalPortal = context.portals.find((p) => p.id === expected.id);
		const account = getDesignatedPlayer(expected.type);

		if (!account) {
			continue; // No designated player found for this portal type
		}

		// 3. Initialize player stats straight on the root performance object
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

		const isPerfectPortal = expected.mechanicRequirements.every((req) => {
			const minOpenMs = phase.start + req.validOpenWindow[0] * 1000;
			const maxOpenMs = phase.start + req.validOpenWindow[1] * 1000;

			const isSuccess =
				physicalPortal !== undefined &&
				physicalPortal.openTime >= minOpenMs &&
				physicalPortal.openTime <= maxOpenMs;

			if (!isSuccess) {
				pStat.missedMechanics.push(req.mechanic);
			}

			// .every() requires returning a boolean. Short-circuits on false.
			return isSuccess;
		});

		if (isPerfectPortal) {
			playerStats.totalSuccessful += 1;
			pStat.successful += 1;
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
