import type {
	CombatReplayJson,
	DecorationRendering,
	DpsReportJson,
} from "../../../../../types/dps-report/elite-insights";
import {
	ACTOR_ORB_CONTACT_RADIUS,
	DELETION_ATTRIBUTION_MARGIN,
	DELETION_CONTACT_RADIUS,
	DIRECT_PICKUP_LOCK_RADIUS,
	DELAYED_PICKUP_EVENT_WINDOW_MS,
	DELAYED_EMPOWERED_EVENT_WINDOW_MS,
	DUPLICATE_TOUCH_WINDOW_MS,
	EMPOWERED_APPLICATION_MECHANIC,
	EVENT_CORRELATION_WINDOW_MS,
	HUNGER_TARGET_IDS,
	INSATIABLE_APPLICATION_MECHANIC,
	LARGE_ORB_DECORATION_SIGNATURE,
	MECHANIC_END_DESPAWN_WINDOW_MS,
	ORB_ATTRIBUTION_TIE_DISTANCE,
	ORB_REQUIRED_UNITS,
	PLAYER_ORB_CONTACT_RADIUS,
	RAGE_HIT_MECHANIC,
	TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
} from "./constants";
import { matchExpectedCollects } from "./collects";
import type {
	InsatiableEmpoweredTransition,
	InsatiableHungerAccounting,
	InsatiableHungerCast,
	InsatiableHungerCollect,
	InsatiableHungerDetails,
	InsatiableOrb,
	InsatiableOrbAccounting,
	InsatiableOrbCollectionState,
	InsatiableOrbEvent,
	InsatiableOrbPickup,
	InsatiableOrbPosition,
	InsatiableOrbTouch,
	InsatiableUnassignedPlayerApplication,
	InsatiableHungerRawCollect,
	InsatiableHungerRawCast,
} from "./types";

const TERMINAL_TOUCH_WINDOW_MS = 2 * 300;
const TOUCH_SCAN_INTERVAL_MS = 25;

type OrbWithDecoration = InsatiableOrb & {
	decoration: DecorationRendering;
	globalIndex: number;
	inferredTouches: InsatiableOrbTouch[];
	deletionCandidate?: InsatiableOrbTouch;
};

type CastWithOrbs = Omit<InsatiableHungerCast, "orbs"> & {
	orbs: OrbWithDecoration[];
};

type PickupWithOrb = InsatiableOrbPickup & { orbKey: number };

type PickupAssignments = {
	byPlayer: Map<string, PickupWithOrb[]>;
	unassigned: InsatiableUnassignedPlayerApplication[];
};

type ProvisionalEmpoweredReservations = Map<number, number>;

type DeletionCandidate = InsatiableOrbTouch;

const pickupEvents = (orb: InsatiableOrb) =>
	orb.events.filter(
		(event): event is Extract<InsatiableOrbEvent, { type: "pickup" }> =>
			event.type === "pickup",
	);

const empoweredEvents = (orb: InsatiableOrb) =>
	orb.events.filter(
		(event): event is Extract<InsatiableOrbEvent, { type: "empowered" }> =>
			event.type === "empowered",
	);

const deleteEvent = (orb: InsatiableOrb) =>
	orb.events.find(
		(event): event is Extract<InsatiableOrbEvent, { type: "delete" }> =>
			event.type === "delete",
	);

const distance = (a: InsatiableOrbPosition, b: InsatiableOrbPosition) =>
	Math.hypot(a[0] - b[0], a[1] - b[1]);

const getPlayerPosition = (
	report: DpsReportJson,
	playerName: string,
	time: number,
): InsatiableOrbPosition | null => {
	const player = report.players.find((candidate) => candidate.name === playerName);
	const replay = player?.combatReplayData;
	if (!replay?.positions.length) return null;

	const pollingRate = report.combatReplayMetaData.pollingRate;
	const baseTime = Math.ceil(replay.start / pollingRate) * pollingRate;
	const index = Math.max(
		0,
		Math.min(
			Math.round((time - baseTime) / pollingRate),
			replay.positions.length - 1,
		),
	);
	return replay.positions[index] ?? null;
};

const getInterpolatedPlayerPosition = (
	report: DpsReportJson,
	playerName: string,
	time: number,
): InsatiableOrbPosition | null => {
	const replay = report.players.find(
		(candidate) => candidate.name === playerName,
	)?.combatReplayData;
	if (!replay?.positions.length || time < replay.start || time > replay.end) {
		return null;
	}

	const pollingRate = report.combatReplayMetaData.pollingRate;
	const baseTime = Math.ceil(replay.start / pollingRate) * pollingRate;
	const sample = Math.max(0, (time - baseTime) / pollingRate);
	const lowerIndex = Math.min(Math.floor(sample), replay.positions.length - 1);
	const upperIndex = Math.min(lowerIndex + 1, replay.positions.length - 1);
	const fraction = sample - Math.floor(sample);
	const lower = replay.positions[lowerIndex];
	const upper = replay.positions[upperIndex];
	if (!lower || !upper) return null;
	return [
		lower[0] + (upper[0] - lower[0]) * fraction,
		lower[1] + (upper[1] - lower[1]) * fraction,
	];
};

const getInterpolatedActorPosition = (
	report: DpsReportJson,
	actorName: string,
	time: number,
): InsatiableOrbPosition | null => {
	const replay = report.targets.find(
		(target) => target.name === actorName,
	)?.combatReplayData;
	if (!replay?.positions.length || time < replay.start || time > replay.end) {
		return null;
	}
	const pollingRate = report.combatReplayMetaData.pollingRate;
	const baseTime = Math.ceil(replay.start / pollingRate) * pollingRate;
	const sample = Math.max(0, (time - baseTime) / pollingRate);
	const lowerIndex = Math.min(Math.floor(sample), replay.positions.length - 1);
	const upperIndex = Math.min(lowerIndex + 1, replay.positions.length - 1);
	const fraction = sample - Math.floor(sample);
	const lower = replay.positions[lowerIndex];
	const upper = replay.positions[upperIndex];
	if (!lower || !upper) return null;
	return [
		lower[0] + (upper[0] - lower[0]) * fraction,
		lower[1] + (upper[1] - lower[1]) * fraction,
	];
};

const getOrbPosition = (
	decoration: DecorationRendering,
	time: number,
): InsatiableOrbPosition | null => {
	const positions = decoration.connectedTo.positions;
	if (!positions || positions.length < 6) return null;

	const startTime = positions[2] ?? decoration.start;
	const endTime = positions[positions.length - 1] ?? decoration.end;
	const fraction = Math.max(
		0,
		Math.min(1, (time - startTime) / Math.max(1, endTime - startTime)),
	);
	const start: InsatiableOrbPosition = [positions[0] ?? 0, positions[1] ?? 0];
	const end: InsatiableOrbPosition = [
		positions[positions.length - 3] ?? 0,
		positions[positions.length - 2] ?? 0,
	];
	return [
		start[0] + (end[0] - start[0]) * fraction,
		start[1] + (end[1] - start[1]) * fraction,
	];
};

const getLargeOrbDecorations = (combatReplay: CombatReplayJson) =>
	combatReplay.decorationRenderings.filter((decoration) => {
		if (decoration.metadataSignature === LARGE_ORB_DECORATION_SIGNATURE) {
			return true;
		}
		const metadata = combatReplay.decorationMetadata.find(
			(candidate) => candidate.signature === decoration.metadataSignature,
		);
		return metadata?.type === 2 && metadata.radius === 30;
	});

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
			return collect ? [{
				index: 0,
				source: cast.source,
				skillId: cast.skillId,
				castTime: cast.castTime,
				endTime: cast.endTime,
				collectName: collect.name,
				phase: collect.phase,
				expectedOrbCount: cast.expectedOrbCount,
				orbs: [],
			}] : [];
		})
		.sort((a, b) => a.castTime - b.castTime)
		.map((cast, index) => ({ ...cast, index }));
};

export const getInsatiableMissedTransitions = (
	report: DpsReportJson,
): InsatiableEmpoweredTransition[] => {
	const hungerTargetIds = new Set<number>(HUNGER_TARGET_IDS);
	const events =
		report.mechanics
			.find((mechanic) => mechanic.name === EMPOWERED_APPLICATION_MECHANIC)
			?.mechanicsData.filter((event) => hungerTargetIds.has(event.id)) ?? [];

	// Five applications to one actor on one combat tick are Malice, not an orb.
	// EI can split that tick over adjacent millisecond timestamps (the committed
	// fixture emits one event at t and four at t+1), so group a 1 ms cluster.
	const maliceGroups: (typeof events)[] = [];
	for (const event of [...events].sort((a, b) => a.time - b.time)) {
		const group = maliceGroups.find(
			(candidate) =>
				candidate[0]?.actor === event.actor &&
				Math.abs((candidate.at(-1)?.time ?? event.time) - event.time) <= 1,
		);
		if (group) group.push(event);
		else maliceGroups.push([event]);
	}
	const excluded = new Set(
		maliceGroups.filter((group) => group.length === 5).flat(),
	);

	// One Empowered application associated with each Cry of Rage hit is not an
	// orb miss. Match the nearest still-available application in [-1s, +3s].
	const rageHits =
		report.mechanics.find((mechanic) => mechanic.name === RAGE_HIT_MECHANIC)
			?.mechanicsData ?? [];
	for (const hit of rageHits) {
		const rageApplication = events
			.filter(
				(event) =>
					!excluded.has(event) &&
					event.time >= hit.time - 1_000 &&
					event.time <= hit.time + 3_000,
			)
			.sort((a, b) => Math.abs(a.time - hit.time) - Math.abs(b.time - hit.time))[0];
		if (rageApplication) excluded.add(rageApplication);
	}

	return events
		.filter((event) => !excluded.has(event))
		.map((event) => ({
			target: event.actor,
			source: EMPOWERED_APPLICATION_MECHANIC,
			time: event.time,
			stackDelta: Math.max(1, event.weight ?? 1),
		}))
		.sort((a, b) => a.time - b.time);
};

const emptyOrbAccounting = (): InsatiableOrbAccounting => ({
	requiredUnits: ORB_REQUIRED_UNITS,
	collectedUnits: 0,
	missedUnits: 0,
	deletedUnits: 0,
	unresolvedUnits: ORB_REQUIRED_UNITS,
	accountedUnits: 0,
	isBalanced: false,
});

const createOrb = (
	decoration: DecorationRendering,
	index: number,
): OrbWithDecoration | null => {
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
		inferredTouches: [],
		collectionCount: 0,
		collectionState: "untouched",
		accounting: emptyOrbAccounting(),
		outcome: "unresolved",
		unresolvedReason: null,
	};
};

const hasUnreservedPlayerCapacity = (
	orb: OrbWithDecoration,
	reservations: ProvisionalEmpoweredReservations,
) =>
	getPlayerUnits(orb) + (reservations.get(orb.globalIndex) ?? 0) <
	ORB_REQUIRED_UNITS;

const assignPickupEvents = (
	report: DpsReportJson,
	orbs: OrbWithDecoration[],
	empoweredReservations: ProvisionalEmpoweredReservations,
	collect: InsatiableHungerRawCollect,
): PickupAssignments => {
	const byPlayer = new Map<string, PickupWithOrb[]>();
	const unassigned: InsatiableUnassignedPlayerApplication[] = [];
	const mechanic = report.mechanics?.find(
		(candidate) => candidate.name === INSATIABLE_APPLICATION_MECHANIC,
	);

	for (const event of mechanic?.mechanicsData ?? []) {
		if (
			event.time < collect.searchWindow[0] ||
			event.time > collect.searchWindow[1]
		) {
			continue;
		}
		const stackDelta = 1;
		const playerPosition = getPlayerPosition(report, event.actor, event.time);
		if (!playerPosition) {
			unassigned.push({
				player: event.actor,
				time: event.time,
				stackDelta,
				reason: "no-active-orb",
			});
			continue;
		}

		const timeCandidates = orbs
			.map((orb) => {
				if (
					event.time < orb.spawnTime - EVENT_CORRELATION_WINDOW_MS ||
					event.time > orb.endTime + DELAYED_PICKUP_EVENT_WINDOW_MS
				) {
					return null;
				}
				const orbPosition = getOrbPosition(orb.decoration, event.time);
				return orbPosition
					? {
							orb,
							distance: distance(playerPosition, orbPosition),
							terminalDelta: Math.abs(orb.endTime - event.time),
						}
					: null;
			})
			.filter(
				(candidate): candidate is {
					orb: OrbWithDecoration;
					distance: number;
					terminalDelta: number;
				} => candidate !== null,
			)
			.sort((a, b) => a.distance - b.distance);
		const candidates = timeCandidates.filter(
			(candidate) =>
				candidate.distance <= PLAYER_ORB_CONTACT_RADIUS &&
				hasUnreservedPlayerCapacity(
					candidate.orb,
					empoweredReservations,
				),
		);

		let best = candidates[0];
		let attribution: InsatiableOrbPickup["attribution"] = "position";
		// EI can emit Insatiable Application one or two replay samples after the
		// physical overlap.  In that gap a player can already be near the next
		// orb.  A recent contact on a decoration that terminates with this event
		// is stronger evidence than the player's position at event time.
		const delayedTerminalCandidates = timeCandidates
			.map((candidate) => {
				if (
					candidate.terminalDelta > TERMINAL_PICKUP_FALLBACK_WINDOW_MS ||
					!hasUnreservedPlayerCapacity(
						candidate.orb,
						empoweredReservations,
					)
				) {
					return null;
				}

				const contactStart = Math.max(
					candidate.orb.spawnTime,
					event.time - TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
				);
				const contactEnd = Math.min(event.time, candidate.orb.endTime);
				if (contactStart > contactEnd) return null;
				let closest: { time: number; distance: number } | null = null;
				for (
					let time =
						Math.ceil(contactStart / report.combatReplayMetaData.pollingRate) *
						report.combatReplayMetaData.pollingRate;
					time <= contactEnd;
					time += report.combatReplayMetaData.pollingRate
				) {
					const recentPlayerPosition = getPlayerPosition(
						report,
						event.actor,
						time,
					);
					const recentOrbPosition = getOrbPosition(candidate.orb.decoration, time);
					if (!recentPlayerPosition || !recentOrbPosition) continue;
					const recentDistance = distance(
						recentPlayerPosition,
						recentOrbPosition,
					);
					if (!closest || recentDistance < closest.distance) {
						closest = { time, distance: recentDistance };
					}
				}
				const terminalPlayerPosition = getPlayerPosition(
					report,
					event.actor,
					contactEnd,
				);
				const terminalOrbPosition = getOrbPosition(
					candidate.orb.decoration,
					contactEnd,
				);
				if (terminalPlayerPosition && terminalOrbPosition) {
					const terminalDistance = distance(
						terminalPlayerPosition,
						terminalOrbPosition,
					);
					if (!closest || terminalDistance < closest.distance) {
						closest = { time: contactEnd, distance: terminalDistance };
					}
				}
				return closest && closest.distance <= PLAYER_ORB_CONTACT_RADIUS
					? { ...candidate, contact: closest }
					: null;
			})
			.filter(
				(candidate): candidate is {
					orb: OrbWithDecoration;
					distance: number;
					terminalDelta: number;
					contact: { time: number; distance: number };
				} => candidate !== null,
			)
			.sort(
				(a, b) =>
					a.terminalDelta - b.terminalDelta ||
					a.contact.distance - b.contact.distance,
			);
		const delayedTerminalBest = delayedTerminalCandidates[0];
		const delayedTerminalRunnerUp = delayedTerminalCandidates[1];
		if (
			delayedTerminalBest &&
			(!best ||
				delayedTerminalBest.orb.globalIndex === best.orb.globalIndex ||
				best.distance > DIRECT_PICKUP_LOCK_RADIUS) &&
			(!delayedTerminalRunnerUp ||
				delayedTerminalRunnerUp.terminalDelta -
					delayedTerminalBest.terminalDelta >=
					report.combatReplayMetaData.pollingRate)
		) {
			best = delayedTerminalBest;
			attribution = "terminal-time";
		}
		if (!best) {
			const terminalCandidates = timeCandidates
				.filter(
					(candidate) =>
						candidate.terminalDelta <= TERMINAL_PICKUP_FALLBACK_WINDOW_MS &&
						hasUnreservedPlayerCapacity(
							candidate.orb,
							empoweredReservations,
						),
				)
				.sort((a, b) => a.terminalDelta - b.terminalDelta);
			const terminalBest = terminalCandidates[0];
			const terminalRunnerUp = terminalCandidates[1];
			if (
				terminalBest &&
				(!terminalRunnerUp ||
					terminalRunnerUp.terminalDelta - terminalBest.terminalDelta >=
						report.combatReplayMetaData.pollingRate)
			) {
				best = terminalBest;
				attribution = "terminal-time";
			}
		}
		if (!best) {
			unassigned.push({
				player: event.actor,
				time: event.time,
				stackDelta,
				reason: "no-active-orb",
			});
			continue;
		}
		let assignedCandidate = best;
		const runnerUp = candidates[1];
		if (
			runnerUp &&
			runnerUp.distance - best.distance <= ORB_ATTRIBUTION_TIE_DISTANCE
		) {
			// Paths can overlap at their destination. When geometry alone is tied,
			// a decoration ending on this replay tick is independent evidence of
			// which orb was actually picked up. Only use that evidence among the
			// geometrically tied candidates, otherwise leave the application open.
			const tiedCandidates = candidates
				.filter(
					(candidate) =>
						candidate.distance - best.distance <= ORB_ATTRIBUTION_TIE_DISTANCE,
				)
				.sort((a, b) => a.terminalDelta - b.terminalDelta);
			const terminalBest = tiedCandidates[0];
			const terminalRunnerUp = tiedCandidates[1];
			if (
				terminalBest &&
				(!terminalRunnerUp ||
					terminalRunnerUp.terminalDelta - terminalBest.terminalDelta >=
							Math.max(1, report.combatReplayMetaData.pollingRate / 2))
			) {
				assignedCandidate = terminalBest;
			} else {
				unassigned.push({
					player: event.actor,
					time: event.time,
					stackDelta,
					reason: "ambiguous-orb",
				});
				continue;
			}
		}

		const pickup: PickupWithOrb = {
			orbKey: assignedCandidate.orb.globalIndex,
			player: event.actor,
			time: event.time,
			distance: assignedCandidate.distance,
			attribution,
			confirmed: true,
		};
		const { orbKey: _orbKey, ...publicPickup } = pickup;
		assignedCandidate.orb.events.push({ type: "pickup", ...publicPickup });
		const playerPickups = byPlayer.get(event.actor) ?? [];
		playerPickups.push(pickup);
		byPlayer.set(event.actor, playerPickups);
	}

	return { byPlayer, unassigned };
};

const inferTerminalTouches = (
	report: DpsReportJson,
	orb: OrbWithDecoration,
	playerPickups: Map<string, PickupWithOrb[]>,
): DeletionCandidate[] => {
	const pollingRate = report.combatReplayMetaData.pollingRate;
	const candidates: DeletionCandidate[] = [];

	for (const player of report.players) {
		if (pickupEvents(orb).some((pickup) => pickup.player === player.name)) {
			continue;
		}
		for (const previousPickup of playerPickups.get(player.name) ?? []) {
			if (previousPickup.orbKey === orb.globalIndex) continue;
			const start = Math.max(
				orb.spawnTime,
				previousPickup.time,
				orb.endTime - TERMINAL_TOUCH_WINDOW_MS,
			);
			const end = Math.min(
				orb.endTime,
				previousPickup.time + DUPLICATE_TOUCH_WINDOW_MS,
			);
			if (start > end) continue;

			let closest: { time: number; distance: number } | null = null;
			for (
				let time = Math.ceil(start / pollingRate) * pollingRate;
				time <= end;
				time += pollingRate
			) {
				const playerPosition = getPlayerPosition(report, player.name, time);
				const orbPosition = getOrbPosition(orb.decoration, time);
				if (!playerPosition || !orbPosition) continue;
				const currentDistance = distance(playerPosition, orbPosition);
				if (!closest || currentDistance < closest.distance) {
					closest = { time, distance: currentDistance };
				}
			}
			if (
				!closest ||
				closest.distance > DELETION_CONTACT_RADIUS ||
				closest.time <= previousPickup.time
			)
				continue;
			candidates.push({
				player: player.name,
				time: closest.time,
				distance: closest.distance,
				confirmed: false,
				priorPickupTime: previousPickup.time,
				priorOrbIndex: previousPickup.orbKey,
				evidence: "terminal-contact",
			});
		}
	}

	const unique = [...new Map(
		candidates.map((candidate) => [
			`${candidate.player}-${candidate.time}-${candidate.priorPickupTime}`,
			candidate,
		]),
	).values()].sort((a, b) => a.distance - b.distance || a.time - b.time);
	const best = unique[0];
	const runnerUp = unique[1];
	if (
		best &&
		(!runnerUp ||
			runnerUp.distance - best.distance >= DELETION_ATTRIBUTION_MARGIN)
	) {
		orb.deletionCandidate = best;
	}
	return unique;
};

/**
 * Look for a duplicate contact between replay samples when an orb still has
 * no observed terminal outcome. This deliberately runs only after confirmed
 * player applications, strong terminal deletions, and Empowered transitions
 * have been reconciled, so ordinary path crossings cannot displace them.
 */
const inferCausalTouches = (
	report: DpsReportJson,
	orb: OrbWithDecoration,
	playerPickups: Map<string, PickupWithOrb[]>,
): DeletionCandidate[] => {
	const candidates: DeletionCandidate[] = [];

	for (const player of report.players) {
		if (pickupEvents(orb).some((pickup) => pickup.player === player.name)) {
			continue;
		}
		for (const previousPickup of playerPickups.get(player.name) ?? []) {
			if (previousPickup.orbKey === orb.globalIndex) continue;
			const start = Math.max(orb.spawnTime, previousPickup.time);
			const end = Math.min(
				orb.endTime,
				previousPickup.time + DUPLICATE_TOUCH_WINDOW_MS,
			);
			if (start > end) continue;

			let firstContactTime: number | null = null;
			let closest: { time: number; distance: number } | null = null;
			for (
				let time = start;
				time <= end;
				time += TOUCH_SCAN_INTERVAL_MS
			) {
				const playerPosition = getInterpolatedPlayerPosition(
					report,
					player.name,
					time,
				);
				const orbPosition = getOrbPosition(orb.decoration, time);
				if (!playerPosition || !orbPosition) continue;
				const currentDistance = distance(playerPosition, orbPosition);
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
				player: player.name,
				time: firstContactTime,
				distance: closest.distance,
				confirmed: false,
				priorPickupTime: previousPickup.time,
				priorOrbIndex: previousPickup.orbKey,
				evidence:
					orb.endTime - firstContactTime <= TERMINAL_TOUCH_WINDOW_MS
						? "terminal-contact"
						: "causal-contact",
			});
		}
	}

	const unique = [...new Map(
		candidates.map((candidate) => [
			`${candidate.player}-${candidate.priorPickupTime}`,
			candidate,
		]),
	).values()].sort((a, b) => a.distance - b.distance || a.time - b.time);
	const best = unique[0];
	const runnerUp = unique[1];
	if (
		best &&
		best.evidence === "terminal-contact" &&
		(!runnerUp ||
			runnerUp.distance - best.distance >= DELETION_ATTRIBUTION_MARGIN)
	) {
		orb.deletionCandidate = best;
	}
	return unique;
};

const getPlayerUnits = (orb: InsatiableOrb) => pickupEvents(orb).length;

const getActorUnits = (orb: InsatiableOrb) =>
	empoweredEvents(orb).reduce(
		(total, transition) => total + (transition.assignedUnits ?? 0),
		0,
	);

const assignEmpoweredTransitions = (
	orbs: OrbWithDecoration[],
	transitions: InsatiableEmpoweredTransition[],
) => {
	let unassignedUnits = 0;
	for (const transition of transitions) {
		let remainingUnits = transition.stackDelta;
		const candidates = orbs
			.map((orb) => ({ orb, delta: transition.time - orb.endTime }))
			.filter(
				({ orb, delta }) =>
					delta >= -EVENT_CORRELATION_WINDOW_MS &&
					delta <= DELAYED_EMPOWERED_EVENT_WINDOW_MS &&
					(orb.deletionCandidate?.evidence !== "terminal-contact" ||
						transition.time < orb.deletionCandidate.time ||
						// A terminal actor stack is stronger evidence than a
						// provisional duplicate-touch deletion. EI may emit the
						// actor transition on the orb's terminal frame, after the
						// replay position that produced the touch candidate.
						Math.abs(delta) <= EVENT_CORRELATION_WINDOW_MS),
			)
			.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
		for (const { orb } of candidates) {
			if (remainingUnits <= 0) break;
			const capacity = Math.max(
				0,
				ORB_REQUIRED_UNITS - getPlayerUnits(orb) - getActorUnits(orb),
			);
			if (capacity === 0) continue;
			const assignedUnits = Math.min(remainingUnits, capacity);
			orb.events.push({ type: "empowered", ...transition, assignedUnits });
			remainingUnits -= assignedUnits;
		}
		unassignedUnits += remainingUnits;
	}
	return unassignedUnits;
};

const getPhaseDespawnTime = (
	report: DpsReportJson,
	orb: OrbWithDecoration,
) =>
	report.phases
		.filter(
			(phase) =>
				phase.end >= orb.spawnTime &&
				Math.abs(phase.end - orb.endTime) <= EVENT_CORRELATION_WINDOW_MS,
		)
		.sort((a, b) => Math.abs(a.end - orb.endTime) - Math.abs(b.end - orb.endTime))[0]
		?.end;

const getCollectionState = (
	collectionCount: number,
): InsatiableOrbCollectionState => {
	if (collectionCount === 0) return "untouched";
	if (collectionCount === 1) return "once";
	if (collectionCount === 2) return "twice";
	if (collectionCount === 3) return "thrice";
	return "more-than-thrice";
};

const isSplit2BugDespawn = (
	cast: InsatiableHungerCast | undefined,
	orb: OrbWithDecoration,
	observedUnits: number,
) =>
	cast?.source.includes("Empowered Embodiment of Gluttony") &&
	cast.orbs.length === 5 &&
	observedUnits === 0 &&
	orb.inferredTouches.length === 0;

const crossedSourceActorBefore = (
	report: DpsReportJson,
	orb: OrbWithDecoration,
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
			distance(orbPosition, actorPosition) <= ACTOR_ORB_CONTACT_RADIUS
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

const resolveOutcome = (
	report: DpsReportJson,
	orb: OrbWithDecoration,
	cast: InsatiableHungerCast | undefined,
) => {
	const playerInsatiableUnits = getPlayerUnits(orb);
	const actorEmpoweredUnits = getActorUnits(orb);
	const observedUnits = playerInsatiableUnits + actorEmpoweredUnits;
	const remainingUnits = Math.max(0, ORB_REQUIRED_UNITS - observedUnits);
	const accounting = emptyOrbAccounting();
	accounting.collectedUnits = playerInsatiableUnits;
	accounting.missedUnits = actorEmpoweredUnits;
	const deletionCandidate = orb.deletionCandidate;
	const crossedActorBeforeDeletion = deletionCandidate
		? crossedSourceActorBefore(report, orb, cast, deletionCandidate.time)
		: false;
	const lateDeletingPlayerApplication = deletionCandidate
		? hasInsatiableApplicationAfterContact(
				report,
				deletionCandidate.player,
				deletionCandidate.time,
				orb.endTime,
			)
		: false;
	const phaseDespawnedAt = getPhaseDespawnTime(report, orb);
	const mechanicEnded =
		cast !== undefined &&
		orb.endTime >= cast.endTime - MECHANIC_END_DESPAWN_WINDOW_MS;

	if (
		actorEmpoweredUnits === 0 &&
		!crossedActorBeforeDeletion &&
		!lateDeletingPlayerApplication &&
		phaseDespawnedAt === undefined &&
		!mechanicEnded &&
		deletionCandidate?.evidence === "terminal-contact" &&
		remainingUnits > 0
	) {
		orb.outcome = "deleted";
		accounting.deletedUnits = remainingUnits;
		const deletionTouch = orb.inferredTouches.find(
			(touch) =>
				touch.player === deletionCandidate.player &&
				touch.time === deletionCandidate.time &&
				touch.priorPickupTime === deletionCandidate.priorPickupTime,
		);
		if (deletionTouch) {
			orb.events.push({
				type: "delete",
				player: deletionCandidate.player,
				time: deletionCandidate.time,
				priorPickupTime: deletionCandidate.priorPickupTime,
				priorOrbIndex: deletionCandidate.priorOrbIndex,
				evidence: deletionCandidate.evidence,
				units: remainingUnits,
				proof: {
				priorInsatiableConfirmed: true,
				noTargetInsatiableApplication: true,
				noActorEmpoweredTransition: true,
				uniqueTerminalContact: true,
				actorPathClear: true,
				priorPickupDeltaMs:
					deletionCandidate.time - deletionCandidate.priorPickupTime,
				terminalDeltaMs: orb.endTime - deletionCandidate.time,
				contactDistance: deletionTouch.distance,
				},
			});
		}
	} else if (observedUnits >= ORB_REQUIRED_UNITS) {
		// A fully observed three-unit ledger disproves any positional deletion
		// candidate produced by overlapping terminal paths.
		delete orb.deletionCandidate;
		orb.inferredTouches = [];
		orb.outcome = empoweredEvents(orb).length > 0 ? "missed" : "collected";
	} else {
		orb.outcome = "unresolved";
		orb.unresolvedReason = phaseDespawnedAt !== undefined
			? "phase-ended"
			: mechanicEnded
				? "mechanic-ended"
				: isSplit2BugDespawn(cast, orb, observedUnits)
					? "split-2-bug-despawn"
					: actorEmpoweredUnits > 0
				? "actor-stack-partial-ledger"
				: lateDeletingPlayerApplication
					? "late-insatiable-application"
				: crossedActorBeforeDeletion
					? "actor-path-crossing-without-empowered"
				: orb.inferredTouches.length > 1
					? "ambiguous-terminal-contact"
					: orb.inferredTouches[0]?.evidence === "causal-contact"
						? "causal-contact-only"
						: observedUnits > 0
							? "partial-ledger-no-terminal-proof"
							: "no-observed-terminal-outcome";
		accounting.unresolvedUnits = remainingUnits;
	}

	if (orb.outcome !== "unresolved") accounting.unresolvedUnits = 0;
	accounting.accountedUnits =
		accounting.collectedUnits +
		accounting.missedUnits +
		accounting.deletedUnits;
	accounting.isBalanced = accounting.accountedUnits === accounting.requiredUnits;
	orb.accounting = accounting;
	orb.collectionCount = observedUnits;
	orb.collectionState = getCollectionState(observedUnits);
};

const toPublicOrb = ({
	decoration: _decoration,
	globalIndex: _globalIndex,
	inferredTouches: _inferredTouches,
	deletionCandidate: _deletionCandidate,
	...orb
}: OrbWithDecoration): InsatiableOrb => orb;

const summarizeAccounting = (
	orbs: InsatiableOrb[],
	unassignedPlayerApplications: InsatiableUnassignedPlayerApplication[],
	unassignedEmpoweredUnits: number,
): InsatiableHungerAccounting => {
	const summary = orbs.reduce<InsatiableHungerAccounting>(
		(total, orb) => ({
			...total,
			requiredUnits: total.requiredUnits + orb.accounting.requiredUnits,
			collectedUnits:
				total.collectedUnits + orb.accounting.collectedUnits,
			missedUnits: total.missedUnits + orb.accounting.missedUnits,
			deletedUnits: total.deletedUnits + orb.accounting.deletedUnits,
			unresolvedUnits:
				total.unresolvedUnits + orb.accounting.unresolvedUnits,
			accountedUnits: total.accountedUnits + orb.accounting.accountedUnits,
			totalOrbs: total.totalOrbs + 1,
			resolvedOrbs: total.resolvedOrbs + (orb.outcome === "unresolved" ? 0 : 1),
			unresolvedOrbs: total.unresolvedOrbs + (orb.outcome === "unresolved" ? 1 : 0),
			isBalanced: false,
		}),
		{
			...emptyOrbAccounting(),
			requiredUnits: 0,
			unresolvedUnits: 0,
			totalOrbs: 0,
			resolvedOrbs: 0,
			unresolvedOrbs: 0,
			unassignedPlayerStackUnits: 0,
			unassignedEmpoweredUnits: 0,
		},
	);
	summary.unassignedPlayerStackUnits = unassignedPlayerApplications.reduce(
		(total, application) => total + application.stackDelta,
		0,
	);
	summary.unassignedEmpoweredUnits = unassignedEmpoweredUnits;
	summary.isBalanced =
		summary.accountedUnits === summary.requiredUnits &&
		summary.unresolvedUnits === 0 &&
		summary.unassignedPlayerStackUnits === 0;
	return summary;
};

const buildCollectDetails = (
	rawCollects: InsatiableHungerRawCollect[],
	casts: InsatiableHungerCast[],
): InsatiableHungerCollect[] => {
	return rawCollects.map((rawCollect) => {
		const orbs = casts
			.filter((cast) => cast.collectName === rawCollect.name)
			.flatMap((cast) => cast.orbs);
		const observedCapacity = Math.min(
			rawCollect.expectedOrbCount,
			orbs.length,
		) * ORB_REQUIRED_UNITS;
		const missedUnits = orbs.reduce(
			(total, orb) => total + orb.accounting.missedUnits,
			0,
		);
		let remainingObservedCapacity = observedCapacity - missedUnits;
		const players: InsatiableHungerCollect["players"] = {};
		let collectedUnits = 0;
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
				collectedUnits += units;
				remainingObservedCapacity -= units;
			}
		}

		let deletedUnits = 0;
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
			deletedUnits += units;
			remainingObservedCapacity -= units;
		}

		const expectedUnits = rawCollect.expectedOrbCount * ORB_REQUIRED_UNITS;
		const missingDecorationUnits =
			expectedUnits - observedCapacity;
		const unresolvedUnits = remainingObservedCapacity + missingDecorationUnits;

		return {
			name: rawCollect.name,
			phase: rawCollect.phase,
			castStarts: rawCollect.casts.map((cast) => cast.castTime),
			searchWindow: rawCollect.searchWindow,
			expectedOrbCount: rawCollect.expectedOrbCount,
			observedOrbCount: orbs.length,
			orbs,
			players,
			collectedUnits,
			missedUnits,
			deletedUnits,
			unresolvedUnits,
			missingDecorationUnits,
			conserved:
				collectedUnits + missedUnits + deletedUnits + unresolvedUnits ===
				expectedUnits,
		};
	});
};

export const summarizeInsatiableCollects = (
	collects: InsatiableHungerCollect[],
): InsatiableHungerAccounting => {
	const expectedOrbs = collects.reduce(
		(total, collect) => total + collect.expectedOrbCount,
		0,
	);
	const observedOrbs = collects.flatMap((collect) => collect.orbs);
	const collectedUnits = collects.reduce(
		(total, collect) => total + collect.collectedUnits,
		0,
	);
	const missedUnits = collects.reduce(
		(total, collect) => total + collect.missedUnits,
		0,
	);
	const deletedUnits = collects.reduce(
		(total, collect) => total + collect.deletedUnits,
		0,
	);
	const unresolvedUnits = collects.reduce(
		(total, collect) => total + collect.unresolvedUnits,
		0,
	);
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
					total + (collect.expectedOrbCount - collect.observedOrbCount),
				0,
			),
		unresolvedOrbs:
			observedOrbs.filter((orb) => orb.outcome === "unresolved").length +
			collects.reduce(
				(total, collect) =>
					total + (collect.expectedOrbCount - collect.observedOrbCount),
				0,
			),
		unassignedPlayerStackUnits: 0,
		unassignedEmpoweredUnits: 0,
	};
};

export const trackInsatiableHungerOrbs = (
	report: DpsReportJson,
	combatReplay: CombatReplayJson | null | undefined,
): InsatiableHungerDetails => {
	if (!combatReplay) {
		return {
			collects: [],
			casts: [],
			empoweredTransitions: [],
			unassignedPlayerApplications: [],
			accounting: summarizeAccounting([], [], 0),
		};
	}

	const { rawCollects, casts: rawCasts } = matchExpectedCollects(report);
	const casts = getHungerCasts(rawCollects, rawCasts);
	const allDecoratedOrbs = getLargeOrbDecorations(combatReplay)
		.sort((a, b) => a.start - b.start)
		.map((decoration, index) => createOrb(decoration, index))
		.filter((orb): orb is OrbWithDecoration => orb !== null);
	const usedOrbKeys = new Set<number>();
	const orbs: OrbWithDecoration[] = [];
	const allEmpoweredTransitions = getInsatiableMissedTransitions(report);
	const empoweredTransitions: InsatiableEmpoweredTransition[] = [];
	const unassignedPlayerApplications: InsatiableUnassignedPlayerApplication[] = [];

	for (const collect of rawCollects) {
		// A collect is an independent evidence boundary. Decorations, Ins.A,
		// Emp.A, deletion proof, and unresolved units never compete with another
		// collect, even when their visual paths happen to be nearby.
		const candidates = allDecoratedOrbs
			.filter(
				(orb) =>
					!usedOrbKeys.has(orb.globalIndex) &&
					orb.spawnTime >= collect.searchWindow[0] &&
					orb.spawnTime <= collect.searchWindow[1],
			)
			.sort((a, b) => a.spawnTime - b.spawnTime)
			.slice(0, collect.expectedOrbCount);
		for (const orb of candidates) {
			usedOrbKeys.add(orb.globalIndex);
			orb.collectName = collect.name;
			orbs.push(orb);
		}

		const collectTransitions = allEmpoweredTransitions.filter(
			(transition) =>
				transition.time >= collect.searchWindow[0] &&
				transition.time <= collect.searchWindow[1],
		);
		empoweredTransitions.push(...collectTransitions);
		assignEmpoweredTransitions(candidates, collectTransitions);
		const empoweredReservations: ProvisionalEmpoweredReservations = new Map(
			candidates.map((orb) => [orb.globalIndex, getActorUnits(orb)]),
		);
		const pickupAssignments = assignPickupEvents(
			report,
			candidates,
			empoweredReservations,
			collect,
		);
		unassignedPlayerApplications.push(...pickupAssignments.unassigned);

		const observedUnits = candidates.reduce(
			(total, orb) => total + getPlayerUnits(orb) + getActorUnits(orb),
			0,
		);
		const fullyResolvedWithoutDeletion =
			observedUnits === collect.expectedOrbCount * ORB_REQUIRED_UNITS;
		if (!fullyResolvedWithoutDeletion) {
			for (const orb of candidates) {
				if (getPlayerUnits(orb) + getActorUnits(orb) >= ORB_REQUIRED_UNITS) continue;
				orb.inferredTouches = inferTerminalTouches(
					report,
					orb,
					pickupAssignments.byPlayer,
				);
				if (orb.inferredTouches.length === 0) {
					orb.inferredTouches = inferCausalTouches(
						report,
						orb,
						pickupAssignments.byPlayer,
					);
				}
			}
		}

		for (const orb of candidates) {
			const cast = casts
			.filter((candidate) => candidate.collectName === collect?.name)
			.map((candidate) => ({
				candidate,
				delta: Math.abs(candidate.castTime - orb.spawnTime),
			}))
			.sort((a, b) => a.delta - b.delta)[0]?.candidate;
		if (!cast) continue;
		cast.orbs.push(orb);
		}
	}

	for (const cast of casts) {
		cast.orbs.sort((a, b) => a.spawnTime - b.spawnTime);
		cast.orbs.forEach((orb, index) => {
			orb.index = index;
			resolveOutcome(report, orb, cast);
		});
	}
	const publicCasts = casts.map((cast) => ({
		...cast,
		orbs: cast.orbs.map(toPublicOrb),
	}));
	const collects = buildCollectDetails(rawCollects, publicCasts);

	return {
		collects,
		casts: publicCasts,
		empoweredTransitions,
		unassignedPlayerApplications,
		accounting: summarizeInsatiableCollects(collects),
	};
};
