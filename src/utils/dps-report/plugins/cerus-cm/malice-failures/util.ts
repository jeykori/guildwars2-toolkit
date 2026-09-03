import type { DpsReportJson } from "../../../../../types";
import { getEuclideanDist } from "../../../utils";
import { getValidPortal } from "../encounter-context/context";
import type { CerusEncounterContext } from "../types";
import type { MaliceTime } from "./types";

const MALICE_TARGET_ID = 25645;

const MECHANICS = {
	maliceTarget: "MalInt.A",
} as const;

export interface MaliceFail {
	actor: string;
	maliceName: string;
}

export const checkMaliceFailures = (
	phaseStart: number,
	timings: readonly MaliceTime[],
	encounterContext: CerusEncounterContext,
	logData: DpsReportJson,
): MaliceFail[] => {
	const failedActors: MaliceFail[] = []; // Changed to array of objects

	// 1. Get metadata, mechanic targets, and Malice NPCs
	const pollingRate = logData.combatReplayMetaData?.pollingRate;
	const scale = logData.combatReplayMetaData.inchToPixel;

	const maliceTargets = logData.mechanics.find(
		(m) => m.name === MECHANICS.maliceTarget,
	)?.mechanicsData;

	const maliceNPCs = logData.targets?.filter((t) => t.id === MALICE_TARGET_ID);

	// Early return if missing critical data
	if (
		!maliceTargets?.length ||
		!maliceNPCs?.length ||
		!pollingRate ||
		!logData.players
	) {
		return failedActors;
	}

	for (const timing of timings) {
		// 2. Validate portal if provided
		const portal = timing.portalId
			? getValidPortal(encounterContext, timing.portalId, "malice")
			: null;

		if (timing.portalId && !portal) {
			continue;
		}

		// 3. Define the target timing window (5 seconds before the expected drop)
		const expectedTargetTimeMs = phaseStart + timing.time * 1000 - 5000;
		const windowStart = expectedTargetTimeMs - 3000;
		const windowEnd = expectedTargetTimeMs + 3000;

		// 4. Find all players targeted by MalInt.A in this window
		const targetedPlayers = maliceTargets
			.filter((hit) => hit.time >= windowStart && hit.time <= windowEnd)
			.map((hit) => ({
				actor: hit.actor,
				mechTime: hit.time,
				expectedDropTime: hit.time + 5000,
			}));

		if (targetedPlayers.length === 0) continue;

		// Instant fail if the mechanic is a fail-on-target
		if (timing.failOnTarget) {
			for (const hit of targetedPlayers) {
				failedActors.push({ actor: hit.actor, maliceName: timing.name });
			}
			continue;
		}

		// Resolve target parameters (Fallback to portal + 450 radius)
		const target =
			timing.dropLocation ??
			(portal
				? {
						location: portal.locationTo,
						radius: 450,
						innerRadius: undefined,
					}
				: null);

		if (!target) continue;

		// 5. Find Malice NPCs that spawned +- 1.5 second from any expected drop time in this group
		const minDropTime =
			Math.min(...targetedPlayers.map((t) => t.expectedDropTime)) - 1500;
		const maxDropTime =
			Math.max(...targetedPlayers.map((t) => t.expectedDropTime)) + 1500;

		const spawnedMalices = maliceNPCs.filter(
			(npc) => npc.firstAware >= minDropTime && npc.firstAware <= maxDropTime,
		);

		// Each player can only be blamed once per wave
		const blamedInThisWave = new Set<string>();

		for (const malice of spawnedMalices) {
			// 6. Get the exact spawn location of the Malice NPC
			const maliceSpawnPos = malice.combatReplayData?.positions?.[0];
			if (!maliceSpawnPos) continue;

			const dist = getEuclideanDist(
				maliceSpawnPos,
				target.location as readonly [number, number],
			);

			let isWrongLocation = false;

			// Evaluate the NPC spawn position against target parameters
			if (dist > target.radius * scale) {
				isWrongLocation = true;
			} else if (
				target.innerRadius !== undefined &&
				dist < target.innerRadius * scale
			) {
				isWrongLocation = true;
			}

			// 7. If the Malice spawned in a bad location, find the closest targeted player
			if (isWrongLocation) {
				let closestActor: string | null = null;
				let minPlayerDist = Infinity;

				for (const targeted of targetedPlayers) {
					if (blamedInThisWave.has(targeted.actor)) continue;

					const player = logData.players.find((p) => p.name === targeted.actor);
					const crData = player?.combatReplayData;

					if (!crData?.positions) continue;

					// Find player position exactly when the Malice spawned
					const firstFrameTime =
						Math.ceil(crData.start / pollingRate) * pollingRate;
					const frameIndex = Math.floor(
						(malice.firstAware - firstFrameTime) / pollingRate,
					);
					const playerPos = crData.positions[frameIndex];

					if (playerPos) {
						const playerToMaliceDist = getEuclideanDist(
							playerPos,
							maliceSpawnPos,
						);

						if (playerToMaliceDist < minPlayerDist) {
							minPlayerDist = playerToMaliceDist;
							closestActor = targeted.actor;
						}
					}
				}

				// Blame the player physically closest to the misplaced Malice
				if (closestActor) {
					failedActors.push({ actor: closestActor, maliceName: timing.name });
					blamedInThisWave.add(closestActor);
				}
			}
		}
	}

	return failedActors;
};
