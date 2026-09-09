import type { DpsReportJson } from "../../../../../../../types";
import { getEuclideanDist, getPlayerPosition } from "../../../../../utils";
import {
	DELETION_ATTRIBUTION_MARGIN,
	DELETION_CONTACT_RADIUS,
	DUPLICATE_TOUCH_WINDOW_MS,
	TOUCH_SCAN_INTERVAL_MS,
} from "../constants";
import type {
	DeletionCandidate,
	PickupWithOrb,
	TrackedInsatiableOrb,
} from "../types";
import {
	getInterpolatedPlayerPosition,
	getOrbPosition,
	pickupEvents,
} from "../util";

const TERMINAL_TOUCH_WINDOW_MS = 2 * 300;

export const inferDeletionTouches = (
	report: DpsReportJson,
	orb: TrackedInsatiableOrb,
	playerPickups: Map<string, PickupWithOrb[]>,
) => {
	// 1. Identify players who legitimately absorbed a unit from this orb
	const excludedPlayers = new Set(pickupEvents(orb).map((p) => p.player));
	const validPriorPickups: PickupWithOrb[] = [];
	for (const [player, pickups] of playerPickups.entries()) {
		if (!excludedPlayers.has(player)) {
			validPriorPickups.push(...pickups);
		}
	}

	// 2. Helper to scan for collisions
	const scanForTouches = (isTerminalPhase: boolean): DeletionCandidate[] => {
		const candidates: DeletionCandidate[] = [];
		const interval = isTerminalPhase
			? report.combatReplayMetaData.pollingRate
			: TOUCH_SCAN_INTERVAL_MS;

		for (const previousPickup of validPriorPickups) {
			// Terminal scan only looks at the end of the orb's life. Causal scans the whole overlap.
			const start = isTerminalPhase
				? Math.max(
						orb.spawnTime,
						previousPickup.time,
						orb.endTime - TERMINAL_TOUCH_WINDOW_MS,
					)
				: Math.max(orb.spawnTime, previousPickup.time);
			const end = Math.min(
				orb.endTime,
				previousPickup.time + DUPLICATE_TOUCH_WINDOW_MS,
			);

			if (start > end) continue;

			let firstContactTime: number | null = null;
			let closest: { time: number; distance: number } | null = null;

			for (
				let time = isTerminalPhase
					? Math.ceil(start / interval) * interval
					: start;
				time <= end;
				time += interval
			) {
				// Use standard position for raw frames, interpolated for sub-tick causal scans
				const pPos = isTerminalPhase
					? getPlayerPosition(previousPickup.player, time, report)
					: getInterpolatedPlayerPosition(report, previousPickup.player, time);
				const oPos = getOrbPosition(orb.decoration, time);

				if (!pPos || !oPos) continue;

				const currentDistance = getEuclideanDist(pPos, oPos);
				if (!closest || currentDistance < closest.distance) {
					closest = { time, distance: currentDistance };
				}
				if (
					firstContactTime === null &&
					currentDistance <= DELETION_CONTACT_RADIUS
				) {
					firstContactTime = time;
				}
			}

			if (
				firstContactTime === null ||
				!closest ||
				closest.distance > DELETION_CONTACT_RADIUS ||
				firstContactTime <= previousPickup.time
			) {
				continue;
			}

			candidates.push({
				player: previousPickup.player,
				time: isTerminalPhase ? closest.time : firstContactTime,
				distance: closest.distance,
				priorPickupTime: previousPickup.time,
				priorOrbIndex: previousPickup.orbKey,
				evidence:
					orb.endTime - firstContactTime <= TERMINAL_TOUCH_WINDOW_MS
						? "terminal-contact"
						: "causal-contact",
			});
		}
		return candidates;
	};

	// 3. Run the fast Terminal scan
	let candidates = scanForTouches(true);

	// 4. If nothing found, fallback to the heavy Causal scan
	if (candidates.length === 0) {
		candidates = scanForTouches(false);
	}

	if (candidates.length === 0) return [];

	// 5. Deduplicate and pick the best attribution
	const unique = [
		...new Map(
			candidates.map((c) => [`${c.player}-${c.priorPickupTime}`, c]),
		).values(),
	].sort((a, b) => a.distance - b.distance || a.time - b.time);

	const best = unique[0];
	const runnerUp = unique[1];

	if (best) {
		if (
			best.evidence === "terminal-contact" &&
			(!runnerUp ||
				runnerUp.distance - best.distance >= DELETION_ATTRIBUTION_MARGIN)
		) {
			orb.deletionCandidate = best;
		} else if (best.evidence === "terminal-contact") {
			// It was terminal, but failed the margin tie-breaker
			orb.unresolvedReason = "ambiguous-terminal-contact";
		} else {
			// It was only a causal touch
			orb.unresolvedReason = "causal-contact-only";
		}
	}
};
