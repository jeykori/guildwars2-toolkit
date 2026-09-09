import type { DpsReportJson } from "../../../../../../../types";
import { getEuclideanDist, getPlayerPosition } from "../../../../../utils";
import {
	DELAYED_PICKUP_EVENT_WINDOW_MS,
	DIRECT_PICKUP_LOCK_RADIUS,
	EVENT_CORRELATION_WINDOW_MS,
	INSATIABLE_APPLICATION_MECHANIC,
	ORB_ATTRIBUTION_TIE_DISTANCE,
	ORB_REQUIRED_UNITS,
	PLAYER_ORB_CONTACT_RADIUS,
	TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
} from "../constants";
import type {
	InsatiableHungerRawCollect,
	InsatiableUnassignedPlayerApplication,
	PickupAssignments,
	PickupWithOrb,
	TrackedInsatiableOrb,
} from "../types";
import { getOrbPosition, getPlayerUnits } from "../util";

// 1. New Helper: Resolves the best contact point for an individual orb
const evaluateOrbContact = (
	report: DpsReportJson,
	orb: TrackedInsatiableOrb,
	event: { actor: string; time: number },
	currentDistance: number | null,
) => {
	const terminalDelta = Math.abs(orb.endTime - event.time);

	// High Confidence: Direct hit on current frame
	if (
		currentDistance !== null &&
		currentDistance <= DIRECT_PICKUP_LOCK_RADIUS
	) {
		return {
			orb,
			distance: currentDistance,
			terminalDelta,
			attribution: "position" as const,
		};
	}

	// Medium Confidence: The event was delayed. Rewind combat replay to find
	// the closest contact right before the orb despawned.
	if (terminalDelta <= TERMINAL_PICKUP_FALLBACK_WINDOW_MS) {
		let bestPastDistance = Infinity;
		const contactStart = Math.max(
			orb.spawnTime,
			event.time - TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
		);
		const contactEnd = Math.min(event.time, orb.endTime);
		const pollingRate = report.combatReplayMetaData.pollingRate;

		// Check interpolated replay ticks
		for (
			let time = Math.ceil(contactStart / pollingRate) * pollingRate;
			time <= contactEnd;
			time += pollingRate
		) {
			const pPos = getPlayerPosition(event.actor, time, report);
			const oPos = getOrbPosition(orb.decoration, time);
			if (pPos && oPos)
				bestPastDistance = Math.min(
					bestPastDistance,
					getEuclideanDist(pPos, oPos),
				);
		}

		// Check the exact terminal frame
		const pTerm = getPlayerPosition(event.actor, contactEnd, report);
		const oTerm = getOrbPosition(orb.decoration, contactEnd);
		if (pTerm && oTerm)
			bestPastDistance = Math.min(
				bestPastDistance,
				getEuclideanDist(pTerm, oTerm),
			);

		if (bestPastDistance <= PLAYER_ORB_CONTACT_RADIUS) {
			return {
				orb,
				distance: bestPastDistance,
				terminalDelta,
				attribution: "terminal-time" as const,
			};
		}
	}

	// Low Confidence: Loose hit. Orb is alive and player is close, but not perfectly centered.
	if (
		currentDistance !== null &&
		currentDistance <= PLAYER_ORB_CONTACT_RADIUS
	) {
		return {
			orb,
			distance: currentDistance,
			terminalDelta,
			attribution: "position" as const,
		};
	}

	return null;
};

// 2. Simplified Main Function
export const assignPickupEvents = (
	report: DpsReportJson,
	orbs: TrackedInsatiableOrb[],
	collect: InsatiableHungerRawCollect,
): PickupAssignments => {
	const byPlayer = new Map<string, PickupWithOrb[]>();
	const unassigned: InsatiableUnassignedPlayerApplication[] = [];
	const mechanic = report.mechanics?.find(
		(m) => m.name === INSATIABLE_APPLICATION_MECHANIC,
	);

	for (const event of mechanic?.mechanicsData ?? []) {
		if (
			event.time < collect.searchWindow[0] ||
			event.time > collect.searchWindow[1]
		)
			continue;

		const playerPosition = getPlayerPosition(event.actor, event.time, report);
		if (!playerPosition) {
			unassigned.push({
				player: event.actor,
				time: event.time,
				reason: "no-active-orb",
			});
			continue;
		}

		// Score all available orbs using the helper
		const candidates = orbs
			.filter(
				(orb) =>
					getPlayerUnits(orb) < ORB_REQUIRED_UNITS &&
					event.time >= orb.spawnTime - EVENT_CORRELATION_WINDOW_MS &&
					event.time <= orb.endTime + DELAYED_PICKUP_EVENT_WINDOW_MS,
			)
			.map((orb) => {
				const currentOrbPos = getOrbPosition(orb.decoration, event.time);
				const currentDist = currentOrbPos
					? getEuclideanDist(playerPosition, currentOrbPos)
					: null;
				return evaluateOrbContact(report, orb, event, currentDist);
			})
			.filter((c): c is NonNullable<typeof c> => c !== null)
			.sort((a, b) => a.distance - b.distance);

		const best = candidates[0];

		if (!best) {
			unassigned.push({
				player: event.actor,
				time: event.time,
				reason: "no-active-orb",
			});
			continue;
		}

		let assignedCandidate = best;

		// Tie-breaker: If paths physically overlap, use despawn time to pick the right orb
		const tiedCandidates = candidates.filter(
			(c) => c.distance - best.distance <= ORB_ATTRIBUTION_TIE_DISTANCE,
		);

		if (tiedCandidates.length > 1) {
			tiedCandidates.sort((a, b) => a.terminalDelta - b.terminalDelta);
			const terminalBest = tiedCandidates[0];
			const terminalRunnerUp = tiedCandidates[1];

			if (
				terminalBest &&
				terminalRunnerUp &&
				terminalRunnerUp.terminalDelta - terminalBest.terminalDelta >=
					Math.max(1, report.combatReplayMetaData.pollingRate / 2)
			) {
				assignedCandidate = terminalBest;
			} else {
				unassigned.push({
					player: event.actor,
					time: event.time,
					reason: "ambiguous-orb",
				});
				continue;
			}
		}

		// Final Assignment
		const pickup: PickupWithOrb = {
			orbKey: assignedCandidate.orb.globalIndex,
			player: event.actor,
			time: event.time,
			distance: assignedCandidate.distance,
			attribution: assignedCandidate.attribution,
		};

		const { orbKey: _, ...publicPickup } = pickup;
		assignedCandidate.orb.events.push({ type: "pickup", ...publicPickup });

		const playerPickups = byPlayer.get(event.actor) ?? [];
		playerPickups.push(pickup);
		byPlayer.set(event.actor, playerPickups);
	}

	return { byPlayer, unassigned };
};
