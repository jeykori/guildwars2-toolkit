import type {
	CombatReplayJson,
	DecorationRendering,
	DpsReportJson,
} from "../../../../../../types/dps-report/elite-insights";
import { matchExpectedCollects } from "./collects";
import {
	INSATIABLE_APPLICATION_MECHANIC,
	ORB_REQUIRED_UNITS,
} from "./constants";
import { inferDeletionTouches } from "./processors/orb-deletion";
import {
	assignEmpoweredTransitions,
	getInsatiableMissedTransitions,
} from "./processors/orb-misses";
import { assignPickupEvents } from "./processors/orb-pickup";
import {
	emptyOrbAccounting,
	resolveOutcome,
} from "./processors/orb-resolution";
import type {
	InsatiableHungerCast,
	InsatiableHungerRawCast,
	InsatiableHungerRawCollect,
	InsatiableOrb,
	InsatiableOrbPosition,
	OrbCollectAccounting,
	OrbCollectDetails,
	SingleOrbCollect,
	TrackedInsatiableOrb,
} from "./types";
import {
	deleteEvent,
	getActorUnits,
	getLargeOrbDecorations,
	getPlayerUnits,
	pickupEvents,
} from "./util";

type CastWithOrbs = Omit<InsatiableHungerCast, "orbs"> & {
	skillId: number;
	orbs: TrackedInsatiableOrb[];
};

const getHungerCasts = (
	rawCollects: InsatiableHungerRawCollect[],
	casts: InsatiableHungerRawCast[],
): CastWithOrbs[] => {
	const collectByCast = new Map(
		rawCollects.flatMap((collect) =>
			collect.casts.map((cast) => [cast, collect] as const),
		),
	);
	return casts
		.flatMap((cast) => {
			const collect = collectByCast.get(cast);
			return collect
				? [
						{
							index: 0,
							source: cast.source,
							skillId: cast.skillId,
							castTime: cast.castTime,
							endTime: cast.endTime,
							collectName: collect.name,
							phase: collect.phase,
							expectedOrbCount: cast.expectedOrbCount,
							orbs: [],
						},
					]
				: [];
		})
		.sort((a, b) => a.castTime - b.castTime)
		.map((cast, index) => ({ ...cast, index }));
};

const createOrb = (
	decoration: DecorationRendering,
	index: number,
): TrackedInsatiableOrb | null => {
	const positions = decoration.connectedTo.positions;
	if (!positions || positions.length < 6) return null;
	const terminalPosition: InsatiableOrbPosition = [
		positions[positions.length - 3] ?? 0,
		positions[positions.length - 2] ?? 0,
	];
	return {
		decoration,
		globalIndex: index,
		index,
		spawnTime: decoration.start,
		endTime: decoration.end,
		spawnPosition: [positions[0] ?? 0, positions[1] ?? 0],
		endPosition: terminalPosition,
		collectName: "",
		events: [],
		collectionCount: 0,
		accounting: emptyOrbAccounting(),
		outcome: "unresolved",
		unresolvedReason: null,
	};
};

const toPublicOrb = ({
	decoration: _decoration,
	globalIndex: _globalIndex,
	deletionCandidate: _deletionCandidate,
	collectName: _collectName,
	spawnTime: _spawnTime,
	spawnPosition: _spawnPosition,
	collectionCount: _collectionCount,
	...orb
}: TrackedInsatiableOrb): InsatiableOrb => orb;

const toPublicCast = ({
	skillId: _skillId,
	...cast
}: CastWithOrbs): InsatiableHungerCast => ({
	...cast,
	orbs: cast.orbs.map(toPublicOrb),
});

export const getCollectOrbs = (
	casts: InsatiableHungerCast[],
	collectName: string,
) =>
	casts
		.filter((cast) => cast.collectName === collectName)
		.flatMap((cast) => cast.orbs);

const buildCollectDetails = (
	rawCollects: InsatiableHungerRawCollect[],
	casts: InsatiableHungerCast[],
): SingleOrbCollect[] => {
	return rawCollects.map((rawCollect) => {
		const orbs = getCollectOrbs(casts, rawCollect.name);
		const observedCapacity =
			Math.min(rawCollect.expectedOrbCount, orbs.length) * ORB_REQUIRED_UNITS;
		const missedUnits = orbs.reduce(
			(total, orb) => total + orb.accounting.missedUnits,
			0,
		);
		let remainingObservedCapacity = observedCapacity - missedUnits;
		const players: SingleOrbCollect["players"] = {};
		for (const orb of orbs) {
			for (const pickup of pickupEvents(orb)) {
				if (remainingObservedCapacity === 0) break;
				const units = Math.min(remainingObservedCapacity, 1);
				const player = players[pickup.player] ?? {
					collectedUnits: 0,
					deletedUnits: 0,
				};
				player.collectedUnits += units;
				players[pickup.player] = player;
				remainingObservedCapacity -= units;
			}
		}

		for (const orb of orbs) {
			const deletion = deleteEvent(orb);
			if (!deletion || remainingObservedCapacity === 0) continue;
			const units = Math.min(
				remainingObservedCapacity,
				orb.accounting.deletedUnits,
			);
			if (units === 0) continue;
			const player = players[deletion.player] ?? {
				collectedUnits: 0,
				deletedUnits: 0,
			};
			player.deletedUnits += units;
			players[deletion.player] = player;
			remainingObservedCapacity -= units;
		}

		return {
			name: rawCollect.name,
			phase: rawCollect.phase,
			expectedOrbCount: rawCollect.expectedOrbCount,
			players,
		};
	});
};

export const summarizeOrbCollects = (
	collects: SingleOrbCollect[],
	casts: InsatiableHungerCast[],
): OrbCollectAccounting => {
	const expectedOrbs = collects.reduce(
		(total, collect) => total + collect.expectedOrbCount,
		0,
	);
	const observedOrbs = casts.flatMap((cast) => cast.orbs);
	const collectedUnits = observedOrbs.reduce(
		(total, orb) => total + orb.accounting.collectedUnits,
		0,
	);
	const missedUnits = observedOrbs.reduce(
		(total, orb) => total + orb.accounting.missedUnits,
		0,
	);
	const deletedUnits = observedOrbs.reduce(
		(total, orb) => total + orb.accounting.deletedUnits,
		0,
	);
	const unresolvedUnits =
		observedOrbs.reduce(
			(total, orb) => total + orb.accounting.unresolvedUnits,
			0,
		) +
		collects.reduce((total, collect) => {
			const observedCount = getCollectOrbs(casts, collect.name).length;
			return (
				total +
				Math.max(0, collect.expectedOrbCount - observedCount) *
					ORB_REQUIRED_UNITS
			);
		}, 0);
	const accountedUnits = collectedUnits + missedUnits + deletedUnits;

	return {
		requiredUnits: expectedOrbs * ORB_REQUIRED_UNITS,
		collectedUnits,
		missedUnits,
		deletedUnits,
		unresolvedUnits,
		accountedUnits,
		isBalanced:
			unresolvedUnits === 0 &&
			accountedUnits === expectedOrbs * ORB_REQUIRED_UNITS,
		totalOrbs: expectedOrbs,
		resolvedOrbs:
			expectedOrbs -
			observedOrbs.filter((orb) => orb.outcome === "unresolved").length -
			collects.reduce(
				(total, collect) =>
					total +
					Math.max(
						0,
						collect.expectedOrbCount -
							getCollectOrbs(casts, collect.name).length,
					),
				0,
			),
		unresolvedOrbs:
			observedOrbs.filter((orb) => orb.outcome === "unresolved").length +
			collects.reduce(
				(total, collect) =>
					total +
					Math.max(
						0,
						collect.expectedOrbCount -
							getCollectOrbs(casts, collect.name).length,
					),
				0,
			),
	};
};

export const trackOrbCollects = (
	report: DpsReportJson,
	combatReplay: CombatReplayJson,
): OrbCollectDetails => {
	const { rawCollects, casts: rawCasts } = matchExpectedCollects(report);
	const casts = getHungerCasts(rawCollects, rawCasts);

	const allDecoratedOrbs = getLargeOrbDecorations(combatReplay)
		.sort((a, b) => a.start - b.start)
		.map((decoration, index) => createOrb(decoration, index))
		.filter((orb): orb is TrackedInsatiableOrb => orb !== null);

	const allEmpoweredTransitions = getInsatiableMissedTransitions(report);
	const usedOrbKeys = new Set<number>();

	// Find mechanic events once for the whole report
	const mechanic = report.mechanics?.find(
		(candidate) => candidate.name === INSATIABLE_APPLICATION_MECHANIC,
	);
	const mechanicEvents = mechanic?.mechanicsData ?? [];

	// Scope results tightly to each collect iteration
	rawCollects.forEach((collect) => {
		const candidates = allDecoratedOrbs
			.filter(
				(orb) =>
					!usedOrbKeys.has(orb.globalIndex) &&
					orb.spawnTime >= collect.searchWindow[0] &&
					orb.spawnTime <= collect.searchWindow[1],
			)
			.sort((a, b) => a.spawnTime - b.spawnTime)
			.slice(0, collect.expectedOrbCount);

		candidates.forEach((orb) => {
			usedOrbKeys.add(orb.globalIndex);
			orb.collectName = collect.name;
		});

		// 1. Calculate explicit units at the collect level
		const collectTransitions = allEmpoweredTransitions.filter(
			(transition) =>
				transition.time >= collect.searchWindow[0] &&
				transition.time <= collect.searchWindow[1],
		);

		const playerEventCount = mechanicEvents.filter(
			(event) =>
				event.time >= collect.searchWindow[0] &&
				event.time <= collect.searchWindow[1],
		).length;

		const observedUnits = playerEventCount + collectTransitions.length;
		const totalUnits = collect.expectedOrbCount * ORB_REQUIRED_UNITS; // ORB_REQUIRED_UNITS is 3

		// 2. Perform standard assignments
		// Players get priority: Insatiable Application (position + correlation) is
		// stronger evidence than Empowered Application (which the game can delay).
		const pickupAssignments = assignPickupEvents(report, candidates, collect);
		assignEmpoweredTransitions(candidates, collectTransitions);

		// If we have exactly the right amount of units, AND the assignment function
		// successfully mapped all of them, the ledger is already perfectly solved!
		const isMissingUnits = observedUnits !== totalUnits;
		const hasUnassignedEvents = pickupAssignments.unassigned.length > 0;

		if (isMissingUnits || hasUnassignedEvents) {
			for (const orb of candidates) {
				if (getPlayerUnits(orb) + getActorUnits(orb) >= ORB_REQUIRED_UNITS) {
					continue;
				}

				inferDeletionTouches(report, orb, pickupAssignments.byPlayer);
			}
		}

		const collectCasts = casts.filter((c) => c.collectName === collect.name);

		if (collectCasts.length > 0) {
			for (const orb of candidates) {
				const closestCast = collectCasts.reduce((best, current) =>
					Math.abs(current.castTime - orb.spawnTime) <
					Math.abs(best.castTime - orb.spawnTime)
						? current
						: best,
				);

				closestCast.orbs.push(orb);
			}
		}
	});

	for (const cast of casts) {
		cast.orbs.sort((a, b) => a.spawnTime - b.spawnTime);
		cast.orbs.forEach((orb, index) => {
			orb.index = index;
			resolveOutcome(report, orb, cast);
		});
	}

	const publicCasts = casts.map(toPublicCast);
	const collects = buildCollectDetails(rawCollects, publicCasts);

	return {
		collects,
		casts: publicCasts,
		accounting: summarizeOrbCollects(collects, publicCasts),
	};
};
