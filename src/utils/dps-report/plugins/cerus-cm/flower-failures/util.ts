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
	const TERRORIST_RADIUS = 500 * logData.combatReplayMetaData.inchToPixel; // 500 inches in pixels

	// Extract basic log arrays
	const { mechanics } = logData;
	const casts = findMechanic(MECHANICS.wailCast, mechanics);
	const initialHits = findMechanic(MECHANICS.flowerInitialHit, mechanics);
	const poolHits = findMechanic(MECHANICS.flowerPoolTick, mechanics);
	const downs = findMechanic(MECHANICS.downed, mechanics);
	const deaths = findMechanic(MECHANICS.dead, mechanics); // NEW

	// Helper: Find earliest death time for each player
	const playerDeathTimes = new Map<string, number>();
	for (const player of logData.players) {
		playerAttempts[player.name] = 0; // Initialize attempts to 0

		const playerDeathTime = deaths
			.filter((d) => d.actor === player.name)
			.map((d) => d.time)?.[0];

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

	// 1) Get exact flower timings
	const flowers = timings.map((expected) => {
		const expectedTime = phaseStart + expected.time * 1000;
		const exactCast = casts.find(
			(c) => Math.abs(c.time - expectedTime) <= 2500,
		);

		const castTime = exactCast ? exactCast.time : expectedTime;
		const expectedInitialHitTime = castTime + 5000;
		const expectedPoolTickTime = castTime + 6000;

		return {
			name: expected.name,
			castTime,
			expectedInitialHitTime,
			expectedPoolTickTime,
		};
	});

	// Identify ALL Terrorist Puddles across the entire phase immediately
	const puddles = combatReplayDecorations?.filter(
		(d) => d.metadataSignature === COMBAT_REPLAY_PUDDLE_SIGNATURE,
	);

	const allTerroristPuddles = puddles?.filter((p) => {
		const pos = p.connectedTo?.position;
		if (!pos) return false;
		return getEuclideanDist(pos, ARENA_CENTER) < TERRORIST_RADIUS;
	});

	const getSeverityRank = (severity: FlowerFail["severity"]) => {
		if (severity === "Failed") return 3;
		if (severity === "Medium") return 2;
		return 1;
	};

	for (const flower of flowers) {
		const playerFails = new Map<string, FlowerFail>();

		for (const player of logData.players) {
			const deathTime = playerDeathTimes.get(player.name) || logData.durationMS;
			if (deathTime > flower.expectedInitialHitTime) {
				// Safely increment with a fallback to 0 to satisfy strict TS checks
				playerAttempts[player.name] = (playerAttempts[player.name] || 0) + 1;
			}
		}

		const recordFail = (
			actor: string,
			reason: FlowerFail["reason"],
			severity: FlowerFail["severity"],
			time: number,
		) => {
			const existing = playerFails.get(actor);

			if (!existing) {
				playerFails.set(actor, {
					actor,
					flowerName: flower.name,
					reason,
					severity,
					time,
				});
			} else if (
				getSeverityRank(severity) > getSeverityRank(existing.severity)
			) {
				existing.severity = severity;
				existing.reason = reason;
				existing.time = time;
			}
		};

		// 2 & 5) Assign blame for Terrorist Puddles spawned DURING this flower
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
					if (!playerPos) continue;

					const dist = getEuclideanDist(playerPos, pos);
					if (dist < minDist) {
						minDist = dist;
						closestPlayer = player;
					}
				}

				if (closestPlayer) {
					// Log in the distinct terrorist list
					terroristPuddles.push({
						actor: closestPlayer,
						flowerName: flower.name,
						time: puddle.start,
					});

					// Count as a flower fail as well
					recordFail(closestPlayer, "Terrorist Puddle", "Failed", puddle.start);
				}
			}
		}

		// 3 & 4) Evaluate Initial and Pool Hits per player
		const currentInitialHits = initialHits.filter(
			(h) => Math.abs(h.time - flower.expectedInitialHitTime) <= 1500,
		);
		const currentPoolHits = poolHits.filter(
			(h) => Math.abs(h.time - flower.expectedPoolTickTime) <= 1500,
		);

		for (const hit of currentInitialHits) {
			const isDowned = didDown(hit.actor, hit.time);
			recordFail(
				hit.actor,
				"Initial Hit",
				isDowned ? "Failed" : "Medium",
				hit.time,
			);
		}

		for (const hit of currentPoolHits) {
			const playerPos = getPlayerPosition(hit.actor, hit.time, logData);
			const distFromCenter = playerPos
				? getEuclideanDist(playerPos, ARENA_CENTER)
				: Infinity;

			if (distFromCenter > TERRORIST_RADIUS) {
				// Hit on the outside edge (failed to port in time)
				const isDowned = didDown(hit.actor, hit.time);
				recordFail(
					hit.actor,
					"Pool Tick",
					isDowned ? "Failed" : "Medium",
					hit.time,
				);
			} else {
				// They are in the center. Check if ANY terrorist puddle is active right now
				const isForgiven = allTerroristPuddles?.some(
					(p) => hit.time >= p.start && hit.time <= p.end,
				);

				if (!isForgiven) {
					// No active terrorist puddle should be here, standard penalty
					const isDowned = didDown(hit.actor, hit.time);
					recordFail(
						hit.actor,
						"Pool Tick",
						isDowned ? "Failed" : "Medium",
						hit.time,
					);
				}
			}
		}

		// Combine player fails for this flower using Array.from
		flowerFails.push(...Array.from(playerFails.values()));
	}

	return {
		flowerFails,
		terroristPuddles,
		playerAttempts,
	};
}
