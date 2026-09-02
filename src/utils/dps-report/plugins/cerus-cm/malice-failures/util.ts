import type { DpsReportJson } from "../../../../../types";
import { getEuclideanDist } from "../../../utils";
import { getValidPortal } from "../encounter-context/context";
import type { CerusEncounterContext } from "../types";
import type { MaliceTime } from "./types";

const MECHANICS = {
	maliceTarget: "MalInt.A",
} as const;

export const checkMaliceFailures = (
	phaseStart: number,
	timings: readonly MaliceTime[],
	encounterContext: CerusEncounterContext,
	logData: DpsReportJson,
): string[] => {
	const failedActors: string[] = [];

	// 1. Get metadata and hits
	const pollingRate = logData.combatReplayMetaData?.pollingRate;
	const scale = logData.combatReplayMetaData.inchToPixel;
	const maliceTargets = logData.mechanics.find(
		(m) => m.name === MECHANICS.maliceTarget,
	)?.mechanicsData;

	// Early return if no data exists
	if (!maliceTargets?.length || !pollingRate || !logData.players) {
		return failedActors;
	}

	for (const timing of timings) {
		// 1. Attempt to get the portal if an ID was provided
		const portal = timing.portalId
			? getValidPortal(encounterContext, timing.portalId, "malice")
			: null;

		// 2. If an ID was provided BUT the portal wasn't found, skip.
		if (timing.portalId && !portal) {
			continue;
		}

		// 3. Define the timing window for this specific Malice
		const maliceHits = maliceTargets.map((hit) => ({
			...hit,
			time: hit.time + 5000, // 5 seconds after target
		}));
		const expectedTimeMs = phaseStart + timing.time * 1000;
		const windowStart = expectedTimeMs - 3000;
		const windowEnd = expectedTimeMs + 3000;

		const hitsInWindow = maliceHits.filter(
			(hit) => hit.time >= windowStart && hit.time <= windowEnd,
		);

		if (timing.failOnTarget) {
			for (const hit of hitsInWindow) {
				failedActors.push(hit.actor);
			}
			continue;
		}

		for (const hit of hitsInWindow) {
			// 4. Find the player's combat replay data
			const player = logData.players.find((p) => p.name === hit.actor);
			const crData = player?.combatReplayData;

			if (!crData?.positions) continue;

			// 5. Calculate frame index based on EI's formula
			const firstFrameTime =
				Math.ceil(crData.start / pollingRate) * pollingRate;
			// Take the next frame
			const frameIndex = Math.ceil((hit.time - firstFrameTime) / pollingRate);
			const playerPos = crData.positions[frameIndex];

			if (playerPos) {
				// Resolve target parameters (Fallback to portal + 450 radius)
				const target =
					timing.dropLocation ??
					(portal
						? {
								location: portal.locationTo,
								radius: 450,
							}
						: null);

				// Failsafe in case neither dropLocation nor portal locationTo exists
				if (!target) {
					continue;
				}

				const dist = getEuclideanDist(
					playerPos,
					target.location as readonly [number, number],
				);

				let isWrongLocation = false;

				// Evaluate position against target parameters
				if (dist > target.radius * scale) {
					isWrongLocation = true;
				} else if (
					target.innerRadius !== undefined &&
					dist < target.innerRadius * scale
				) {
					isWrongLocation = true;
				}

				if (isWrongLocation) {
					failedActors.push(hit.actor);
				}
			}
		}
	}

	return failedActors;
};
