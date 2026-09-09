import type { DpsReportJson } from "../../../../../../../types";
import { getEuclideanDist } from "../../../../../utils";
import {
	ACTOR_ORB_CONTACT_RADIUS,
	DELAYED_PICKUP_EVENT_WINDOW_MS,
	EVENT_CORRELATION_WINDOW_MS,
	INSATIABLE_APPLICATION_MECHANIC,
	MECHANIC_END_DESPAWN_WINDOW_MS,
	ORB_REQUIRED_UNITS,
	TOUCH_SCAN_INTERVAL_MS,
} from "../constants";
import type {
	InsatiableHungerCast,
	InsatiableUnresolvedReason,
	SingleOrbAccounting,
	TrackedInsatiableOrb,
} from "../types";
import {
	getActorUnits,
	getInterpolatedActorPosition,
	getOrbPosition,
	getPlayerUnits,
} from "../util";

const getPhaseDespawnTime = (
	report: DpsReportJson,
	orb: TrackedInsatiableOrb,
) =>
	report.phases
		.filter(
			(phase) =>
				phase.end >= orb.spawnTime &&
				Math.abs(phase.end - orb.endTime) <= EVENT_CORRELATION_WINDOW_MS,
		)
		.sort(
			(a, b) => Math.abs(a.end - orb.endTime) - Math.abs(b.end - orb.endTime),
		)[0]?.end;

const crossedSourceActorBefore = (
	report: DpsReportJson,
	orb: TrackedInsatiableOrb,
	cast: InsatiableHungerCast | undefined,
	time: number,
) => {
	if (!cast) return false;
	for (
		let sampleTime = orb.spawnTime;
		sampleTime <= Math.min(time, orb.endTime);
		sampleTime += TOUCH_SCAN_INTERVAL_MS
	) {
		const orbPosition = getOrbPosition(orb.decoration, sampleTime);
		const actorPosition = getInterpolatedActorPosition(
			report,
			cast.source,
			sampleTime,
		);
		if (
			orbPosition &&
			actorPosition &&
			getEuclideanDist(orbPosition, actorPosition) <= ACTOR_ORB_CONTACT_RADIUS
		) {
			return true;
		}
	}
	return false;
};

const hasInsatiableApplicationAfterContact = (
	report: DpsReportJson,
	player: string,
	contactTime: number,
	orbEndTime: number,
) =>
	report.mechanics
		?.find((mechanic) => mechanic.name === INSATIABLE_APPLICATION_MECHANIC)
		?.mechanicsData.some(
			(event) =>
				event.actor === player &&
				event.time > contactTime &&
				event.time <= orbEndTime + DELAYED_PICKUP_EVENT_WINDOW_MS,
		) ?? false;

export const emptyOrbAccounting = (): SingleOrbAccounting => ({
	requiredUnits: ORB_REQUIRED_UNITS,
	collectedUnits: 0,
	missedUnits: 0,
	deletedUnits: 0,
	unresolvedUnits: ORB_REQUIRED_UNITS,
	accountedUnits: 0,
	isBalanced: false,
});

export const resolveOutcome = (
	report: DpsReportJson,
	orb: TrackedInsatiableOrb,
	cast: InsatiableHungerCast | undefined,
) => {
	const playerInsatiableUnits = getPlayerUnits(orb);
	const actorEmpoweredUnits = getActorUnits(orb);
	const observedUnits = playerInsatiableUnits + actorEmpoweredUnits;
	const remainingUnits = Math.max(0, ORB_REQUIRED_UNITS - observedUnits);

	const accounting = emptyOrbAccounting();
	accounting.collectedUnits = playerInsatiableUnits;
	accounting.missedUnits = actorEmpoweredUnits;
	orb.collectionCount = observedUnits;

	// 1. Happy Path
	if (observedUnits >= ORB_REQUIRED_UNITS) {
		delete orb.deletionCandidate;
		orb.outcome = actorEmpoweredUnits > 0 ? "missed" : "collected";
		accounting.unresolvedUnits = 0;
	}
	// 2. Deletion Path
	else {
		const candidate = orb.deletionCandidate;
		const phaseDespawnedAt = getPhaseDespawnTime(report, orb);
		const mechanicEnded =
			cast !== undefined &&
			orb.endTime >= cast.endTime - MECHANIC_END_DESPAWN_WINDOW_MS;
		const crossedActor = candidate
			? crossedSourceActorBefore(report, orb, cast, candidate.time)
			: false;
		const lateApplication = candidate
			? hasInsatiableApplicationAfterContact(
					report,
					candidate.player,
					candidate.time,
					orb.endTime,
				)
			: false;

		const isValidDeletion =
			candidate?.evidence === "terminal-contact" &&
			actorEmpoweredUnits === 0 &&
			phaseDespawnedAt === undefined &&
			!mechanicEnded &&
			!crossedActor &&
			!lateApplication;

		if (isValidDeletion) {
			orb.outcome = "deleted";
			accounting.deletedUnits = remainingUnits;
			accounting.unresolvedUnits = 0;

			orb.events.push({
				type: "delete",
				player: candidate.player,
				time: candidate.time,
				priorPickupTime: candidate.priorPickupTime,
				priorOrbIndex: candidate.priorOrbIndex,
				evidence: candidate.evidence,
				units: remainingUnits,
				proof: {
					priorPickupDeltaMs: candidate.time - candidate.priorPickupTime,
					terminalDeltaMs: orb.endTime - candidate.time,
					contactDistance: candidate.distance,
				},
			});
		}
		// 3. Unresolved Path (Delegated to util!)
		else {
			orb.outcome = "unresolved";
			accounting.unresolvedUnits = remainingUnits;

			orb.unresolvedReason = determineUnresolvedReason(orb, cast, {
				observedUnits,
				actorEmpoweredUnits,
				phaseDespawnedAt,
				mechanicEnded,
				crossedActor,
				lateApplication,
			});
		}
	}

	accounting.accountedUnits =
		accounting.collectedUnits +
		accounting.missedUnits +
		accounting.deletedUnits;
	accounting.isBalanced =
		accounting.accountedUnits === accounting.requiredUnits;
	orb.accounting = accounting;
};

/**
 * Evaluates the priority chain of failure reasons for an unresolved orb.
 * Add new edge case checks here as you find them in future logs.
 */
export const determineUnresolvedReason = (
	orb: TrackedInsatiableOrb,
	cast: InsatiableHungerCast | undefined,
	context: {
		observedUnits: number;
		actorEmpoweredUnits: number;
		phaseDespawnedAt: number | undefined;
		mechanicEnded: boolean;
		crossedActor: boolean;
		lateApplication: boolean;
	},
): InsatiableUnresolvedReason => {
	const {
		observedUnits,
		actorEmpoweredUnits,
		phaseDespawnedAt,
		mechanicEnded,
		crossedActor,
		lateApplication,
	} = context;

	if (phaseDespawnedAt !== undefined) return "phase-ended";
	if (mechanicEnded) return "mechanic-ended";
	if (isSplit2BugDespawn(cast, orb, observedUnits)) {
		return "split-2-bug-despawn";
	}
	if (actorEmpoweredUnits > 0) return "actor-stack-partial-ledger";
	if (lateApplication) return "late-insatiable-application";
	if (crossedActor) return "actor-path-crossing-without-empowered";

	// Passes down reasons set earlier by inference (e.g., ambiguous or causal touches)
	if (orb.unresolvedReason) return orb.unresolvedReason;

	if (observedUnits > 0) return "partial-ledger-no-terminal-proof";

	return "no-observed-terminal-outcome";
};

const isSplit2BugDespawn = (
	cast: InsatiableHungerCast | undefined,
	orb: TrackedInsatiableOrb,
	observedUnits: number,
) =>
	cast?.source.includes("Empowered Embodiment of Gluttony") &&
	cast.orbs.length === 5 &&
	observedUnits === 0 &&
	!orb.deletionCandidate;
