import type { DpsReportJson } from "../../../../../types";
import type { DecorationRendering } from "../../../../../types/dps-report/elite-insights/combat-replay-json";
import { getEuclideanDist, getPlayerPosition } from "../../../utils";
import type {
	FlowerFail,
	FlowerMechanicsResult,
	TerroristPuddleFail,
	Timing,
} from "./types";

const MECHANICS = {
	wailCast: "WailDesp.C",
	flowerInitialHit: "Emp.WailDesp.H",
	flowerPoolTick: "Emp.PoolDesp.H",
	downed: "Downed",
	dead: "Dead", // NEW
} as const;

// Cir240rgba(255, 0, 0, 0.2)0 works as well
const COMBAT_REPLAY_PUDDLE_SIGNATURE = "Cir240rgba(198, 101, 94, 0.2)0";

const findMechanic = (name: string, mechanics: DpsReportJson["mechanics"]) =>
	mechanics.find((m) => m.name === name)?.mechanicsData || [];

export function checkFlowerFailures(
	phaseStart: number,
	timings: readonly Timing[],
	logData: DpsReportJson,
	combatReplayDecorations?: DecorationRendering[],
): FlowerMechanicsResult {
	const flowerFails: FlowerFail[] = [];
	const terroristPuddles: TerroristPuddleFail[] = [];
	const playerAttempts: Record<string, number> = {};

	const ARENA_CENTER = [375, 375] as const;
	const TERRORIST_RADIUS = 450 * logData.combatReplayMetaData.inchToPixel;

	// Extract basic log arrays
	const { mechanics } = logData;
	const casts = findMechanic(MECHANICS.wailCast, mechanics);
	const initialHits = findMechanic(MECHANICS.flowerInitialHit, mechanics);
	const poolHits = findMechanic(MECHANICS.flowerPoolTick, mechanics);
	const downs = findMechanic(MECHANICS.downed, mechanics);
	const deaths = findMechanic(MECHANICS.dead, mechanics);

	// Helper: Find earliest death time for each player
	const playerDeathTimes = new Map<string, number>();
	for (const player of logData.players) {
		playerAttempts[player.name] = 0;
		const playerDeathTime = deaths.find((d) => d.actor === player.name)?.time;
		if (playerDeathTime !== undefined) {
			playerDeathTimes.set(player.name, playerDeathTime);
		}
	}

	// Helper: Check if player downed within 3 seconds of a hit
	const didDown = (actor: string, hitTime: number): boolean => {
		return downs.some(
			(d) => d.actor === actor && d.time >= hitTime && d.time <= hitTime + 3000,
		);
	};

	const flowers = timings.map((expected) => {
		const expectedTime = phaseStart + expected.time * 1000;
		const exactCast = casts.find(
			(c) => Math.abs(c.time - expectedTime) <= 2500,
		);

		const castTime = exactCast ? exactCast.time : expectedTime;
		return {
			name: expected.name,
			castTime,
			expectedInitialHitTime: castTime + 5000,
			expectedPoolTickTime: castTime + 6000,
		};
	});

	const allTerroristPuddles = combatReplayDecorations?.filter((p) => {
		if (p.metadataSignature !== COMBAT_REPLAY_PUDDLE_SIGNATURE) return false;
		const pos = p.connectedTo?.position;
		return pos && getEuclideanDist(pos, ARENA_CENTER) < TERRORIST_RADIUS;
	});

	for (const flower of flowers) {
		const playerState = new Map<
			string,
			{ initialHit: boolean; poolTick: boolean; death: boolean }
		>();

		const getPlayerState = (actor: string) => {
			if (!playerState.has(actor)) {
				playerState.set(actor, {
					initialHit: false,
					poolTick: false,
					death: false,
				});
			}
			// biome-ignore lint/style/noNonNullAssertion: initiatized above
			return playerState.get(actor)!;
		};

		for (const player of logData.players) {
			const deathTime = playerDeathTimes.get(player.name) || logData.durationMS;
			if (deathTime > flower.expectedInitialHitTime) {
				playerAttempts[player.name] = (playerAttempts[player.name] || 0) + 1;
			}
		}

		// 1) Isolate Terrorist Puddles (No longer affects flower fails)
		const spawnedTerroristPuddles = allTerroristPuddles?.filter(
			(p) => Math.abs(p.start - flower.expectedInitialHitTime) <= 2000,
		);

		if (spawnedTerroristPuddles) {
			for (const puddle of spawnedTerroristPuddles) {
				const pos = puddle.connectedTo.position;
				if (!pos) continue;

				let closestPlayer = "";
				let minDist = Infinity;

				for (const player of logData.players.map((p) => p.name)) {
					const playerPos = getPlayerPosition(player, puddle.start, logData);
					if (playerPos) {
						const dist = getEuclideanDist(playerPos, pos);
						if (dist < minDist) {
							minDist = dist;
							closestPlayer = player;
						}
					}
				}

				if (closestPlayer) {
					terroristPuddles.push({
						actor: closestPlayer,
						flowerName: flower.name,
						time: puddle.start,
					});
				}
			}
		}

		// 2) Check Initial Hits
		const currentInitialHits = initialHits.filter(
			(h) => Math.abs(h.time - flower.expectedInitialHitTime) <= 1500,
		);
		for (const hit of currentInitialHits) {
			const state = getPlayerState(hit.actor);
			state.initialHit = true;
			if (didDown(hit.actor, hit.time)) state.death = true;
		}

		// 3) Check Pool Ticks
		const currentPoolHits = poolHits.filter(
			(h) => Math.abs(h.time - flower.expectedPoolTickTime) <= 1500,
		);
		for (const hit of currentPoolHits) {
			const playerPos = getPlayerPosition(hit.actor, hit.time, logData);
			const distFromCenter = playerPos
				? getEuclideanDist(playerPos, ARENA_CENTER)
				: Infinity;

			let shouldForgive = false;
			if (distFromCenter <= TERRORIST_RADIUS) {
				// In center: forgive if any terrorist puddle is active
				shouldForgive = !!allTerroristPuddles?.some(
					(p) => hit.time >= p.start && hit.time <= p.end,
				);
			}

			if (!shouldForgive) {
				const state = getPlayerState(hit.actor);
				state.poolTick = true;
				if (didDown(hit.actor, hit.time)) state.death = true;
			}
		}

		// 4) Compile the fails for this flower
		for (const [actor, state] of playerState.entries()) {
			// If they got hit by EITHER mechanic, it counts as a flower fail
			if (state.initialHit || state.poolTick) {
				flowerFails.push({
					actor,
					flowerName: flower.name,
					initialHit: state.initialHit,
					poolTick: state.poolTick,
					death: state.death,
				});
			}
		}
	}

	return {
		flowerFails,
		terroristPuddles,
		playerAttempts,
	};
}
