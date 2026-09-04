import type { DpsReportJson } from "../../../../../../types";
import type { DecorationRendering } from "../../../../../../types/dps-report/elite-insights/combat-replay-json";
import { getEuclideanDist, getPlayerPosition } from "../../../../utils";
import { getValidPortal } from "../../encounter-context/context";
import type { CerusEncounterContext } from "../../types";
import type {
	FlowerFail,
	FlowerMechanicsResult,
	FlowerTime,
	TerroristPuddleFail,
} from "./types";

type ProcessedFlower = FlowerTime & {
	castTime: number;
	expectedInitialHitTime: number;
	expectedPoolTickTime: number;
};

const MECHANICS = {
	wailCast: "WailDesp.C",
	flowerInitialHit: "Emp.WailDesp.H",
	flowerPoolTick: "Emp.PoolDesp.H",
	downed: "Downed",
	dead: "Dead",
} as const;

// Cir240rgba(255, 0, 0, 0.2)0 works as well
const COMBAT_REPLAY_PUDDLE_SIGNATURE = "Cir240rgba(198, 101, 94, 0.2)0";
const ARENA_CENTER = [375, 375] as const;

const findMechanic = (name: string, mechanics: DpsReportJson["mechanics"]) =>
	mechanics.find((m) => m.name === name)?.mechanicsData || [];

function getTerroristFails(
	flower: ProcessedFlower,
	allTerroristPuddles: DecorationRendering[] | undefined,
	logData: DpsReportJson,
): TerroristPuddleFail[] {
	const fails: TerroristPuddleFail[] = [];
	const spawnedPuddles = allTerroristPuddles?.filter(
		(p) => Math.abs(p.start - flower.expectedInitialHitTime) <= 2000,
	);

	if (!spawnedPuddles) return fails;

	for (const puddle of spawnedPuddles) {
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
			fails.push({
				actor: closestPlayer,
				flowerName: flower.name,
				time: puddle.start,
			});
		}
	}

	return fails;
}

export function checkFlowerFailures(
	phaseStart: number,
	timings: readonly FlowerTime[],
	encounterContext: CerusEncounterContext,
	logData: DpsReportJson,
	combatReplayDecorations?: DecorationRendering[],
): FlowerMechanicsResult {
	const flowerFails: FlowerFail[] = [];
	const terroristPuddles: TerroristPuddleFail[] = [];
	const playerAttempts: Record<string, number> = {};

	const TERRORIST_RADIUS = 450 * logData.combatReplayMetaData.inchToPixel;

	const { mechanics } = logData;
	const casts = findMechanic(MECHANICS.wailCast, mechanics);
	const initialHits = findMechanic(MECHANICS.flowerInitialHit, mechanics);
	const poolHits = findMechanic(MECHANICS.flowerPoolTick, mechanics);
	const downs = findMechanic(MECHANICS.downed, mechanics);
	const deaths = findMechanic(MECHANICS.dead, mechanics);

	const playerDeathTimes = new Map<string, number>();
	for (const player of logData.players) {
		playerAttempts[player.name] = 0;
		const playerDeathTime = deaths.find((d) => d.actor === player.name)?.time;
		if (playerDeathTime !== undefined) {
			playerDeathTimes.set(player.name, playerDeathTime);
		}
	}

	const didDown = (actor: string, hitTime: number): boolean =>
		downs.some(
			(d) => d.actor === actor && d.time >= hitTime && d.time <= hitTime + 3000,
		);

	const allTerroristPuddles = combatReplayDecorations?.filter((p) => {
		if (p.metadataSignature !== COMBAT_REPLAY_PUDDLE_SIGNATURE) return false;
		const pos = p.connectedTo?.position;
		return pos && getEuclideanDist(pos, ARENA_CENTER) < TERRORIST_RADIUS;
	});

	const flowers: ProcessedFlower[] = timings.map((expected) => {
		const expectedTime = phaseStart + expected.time * 1000;
		const exactCast = casts.find(
			(c) => Math.abs(c.time - expectedTime) <= 2500,
		);
		const castTime = exactCast ? exactCast.time : expectedTime;

		return {
			...expected,
			castTime,
			expectedInitialHitTime: castTime + 5000,
			expectedPoolTickTime: castTime + 6000,
		};
	});

	for (const flower of flowers) {
		if (flower.expectedInitialHitTime > logData.durationMS) {
			break;
		}

		// 1) Track Attempts
		for (const player of logData.players) {
			const deathTime = playerDeathTimes.get(player.name) || logData.durationMS;
			if (deathTime > flower.expectedInitialHitTime) {
				playerAttempts[player.name] = (playerAttempts[player.name] || 0) + 1;
			}
		}

		// 2) Isolate Terrorist Puddles
		terroristPuddles.push(
			...getTerroristFails(flower, allTerroristPuddles, logData),
		);

		// 3) Process Hits
		const playerState = new Map<
			string,
			{ initialHit: boolean; poolTick: boolean; death: boolean }
		>();
		const getPlayerState = (actor: string) => {
			if (!playerState.has(actor))
				playerState.set(actor, {
					initialHit: false,
					poolTick: false,
					death: false,
				});
			// biome-ignore lint/style/noNonNullAssertion: initiatized above
			return playerState.get(actor)!;
		};

		const currentInitialHits = initialHits.filter(
			(h) => Math.abs(h.time - flower.expectedInitialHitTime) <= 1500,
		);
		for (const hit of currentInitialHits) {
			const state = getPlayerState(hit.actor);
			state.initialHit = true;
			if (didDown(hit.actor, hit.time)) state.death = true;
		}

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

		// 4) Compile Fails (Forgive everyone if portal failed)
		if (
			flower.hasPortal &&
			getValidPortal(encounterContext, flower.portalId, ["flower"]).isValid
		) {
			for (const [actor, state] of playerState.entries()) {
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
	}

	return { flowerFails, terroristPuddles, playerAttempts };
}
