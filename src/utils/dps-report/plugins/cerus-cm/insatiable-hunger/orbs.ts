import type {
	CombatReplayJson,
	DecorationRendering,
	DpsReportJson,
	TargetBuff,
} from "../../../../../types/dps-report/elite-insights";
import {
	ACTOR_ORB_CONTACT_RADIUS,
	CONFIRMED_PICKUP_CONTACT_RADIUS,
	DELETION_ATTRIBUTION_MARGIN,
	DELETION_CONTACT_RADIUS,
	DIRECT_PICKUP_LOCK_RADIUS,
	DELAYED_PICKUP_EVENT_WINDOW_MS,
	DELAYED_EMPOWERED_EVENT_WINDOW_MS,
	DUPLICATE_TOUCH_WINDOW_MS,
	EMPOWERED_BUFF_ID,
	EVENT_CORRELATION_WINDOW_MS,
	HUNGER_SKILL_IDS,
	INSATIABLE_APPLICATION_MECHANIC,
	INSATIABLE_BUFF_ID,
	LARGE_ORB_DECORATION_SIGNATURE,
	MECHANIC_END_DESPAWN_WINDOW_MS,
	ORB_ATTRIBUTION_TIE_DISTANCE,
	ORB_REQUIRED_UNITS,
	PLAYER_ORB_CONTACT_RADIUS,
	TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
} from "./constants";
import type {
	InsatiableEmpoweredTransition,
	InsatiableHungerAccounting,
	InsatiableHungerCast,
	InsatiableHungerDetails,
	InsatiableOrb,
	InsatiableOrbAccounting,
	InsatiableOrbCollectionState,
	InsatiableOrbPickup,
	InsatiableOrbPosition,
	InsatiableOrbTouch,
	InsatiableUnassignedPlayerApplication,
} from "./types";

const TERMINAL_TOUCH_WINDOW_MS = 2 * 300;
const TOUCH_SCAN_INTERVAL_MS = 25;
const CAST_ORB_ASSIGNMENT_WINDOW_MS = 4000;

type OrbWithDecoration = InsatiableOrb & {
	decoration: DecorationRendering;
	globalIndex: number;
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

const getHungerCasts = (report: DpsReportJson): CastWithOrbs[] => {
	const casts: CastWithOrbs[] = [];
	for (const target of report.targets) {
		if (target.name !== "Cerus" && !target.name.includes("Gluttony")) continue;
		for (const rotation of target.rotation) {
			if (!(HUNGER_SKILL_IDS as readonly number[]).includes(rotation.id)) {
				continue;
			}
			for (const skill of rotation.skills) {
				casts.push({
					index: 0,
					source: target.name,
					skillId: rotation.id,
					castTime: skill.castTime,
					endTime: skill.castTime + skill.duration,
					orbs: [],
				});
			}
		}
	}
	return casts
		.sort((a, b) => a.castTime - b.castTime)
		.map((cast, index) => ({ ...cast, index }));
};

const getPositiveTransitions = (
	states: [number, number][] | undefined,
	source: string,
	target: string,
): InsatiableEmpoweredTransition[] => {
	if (!states?.length) return [];
	const transitions: InsatiableEmpoweredTransition[] = [];
	let previousStack = 0;
	for (const [time, stack] of states) {
		if (stack > previousStack) {
			transitions.push({
				target,
				source,
				time,
				stackDelta: stack - previousStack,
			});
		}
		previousStack = stack;
	}
	return transitions;
};

const getEmpoweredTransitions = (
	report: DpsReportJson,
): InsatiableEmpoweredTransition[] => {
	const transitions: InsatiableEmpoweredTransition[] = [];
	for (const target of report.targets) {
		if (target.name !== "Cerus" && !target.name.includes("Embodiment")) {
			continue;
		}
		const empowered = target.buffs?.find(
			(buff: TargetBuff) => buff.id === EMPOWERED_BUFF_ID,
		);
		if (!empowered) continue;
		if (empowered.statesPerSource) {
			for (const [source, states] of Object.entries(
				empowered.statesPerSource,
			)) {
				transitions.push(
					...getPositiveTransitions(states, source, target.name),
				);
			}
		} else {
			transitions.push(
				...getPositiveTransitions(empowered.states, "unknown", target.name),
			);
		}
	}
	return transitions.sort((a, b) => a.time - b.time);
};

const getInsatiableStackTransition = (
	report: DpsReportJson,
	playerName: string,
	time: number,
): Pick<InsatiableOrbPickup, "stackDelta" | "stackBefore" | "stackAfter"> => {
	const states = report.players
		.find((player) => player.name === playerName)
		?.buffUptimes?.find((buff) => buff.id === INSATIABLE_BUFF_ID)?.states;
	if (!states?.length) return { stackDelta: 1 };

	let previousStack = 0;
	for (const [stateTime, stack] of states) {
		if (stateTime < time) {
			previousStack = stack;
			continue;
		}
		if (stateTime <= time + EVENT_CORRELATION_WINDOW_MS) {
			return {
				stackDelta: Math.max(1, stack - previousStack),
				stackBefore: previousStack,
				stackAfter: stack,
			};
		}
		break;
	}
	// The mechanic event is authoritative if buff states are incomplete.
	return { stackDelta: 1 };
};

const emptyOrbAccounting = (): InsatiableOrbAccounting => ({
	requiredUnits: ORB_REQUIRED_UNITS,
	playerInsatiableUnits: 0,
	actorEmpoweredUnits: 0,
	deletedUnits: 0,
	phaseDespawnedUnits: 0,
	mechanicEndedUnits: 0,
	split2BugDespawnUnits: 0,
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
		playerPickups: [],
		inferredTouches: [],
		empoweredTransitions: [],
		collectionCount: 0,
		collectionState: "untouched",
		accounting: emptyOrbAccounting(),
		outcome: "unresolved",
		unresolvedReason: null,
		terminalTime: decoration.end,
		terminalPosition,
	};
};

/**
 * Reserve capacity for direct actor evidence before assigning player events.
 * A delayed player application must not fill the third slot of an orb whose
 * terminal frame already produced an Empowered transition.
 */
const reserveDirectEmpoweredUnits = (
	orbs: OrbWithDecoration[],
	transitions: InsatiableEmpoweredTransition[],
): ProvisionalEmpoweredReservations => {
	const reservations: ProvisionalEmpoweredReservations = new Map();
	for (const transition of transitions) {
		let remainingUnits = transition.stackDelta;
		const candidates = orbs
			.map((orb) => ({
				orb,
				delta: Math.abs(orb.endTime - transition.time),
			}))
			.filter(({ delta }) => delta <= EVENT_CORRELATION_WINDOW_MS)
			.sort((a, b) => a.delta - b.delta);
		for (const { orb } of candidates) {
			if (remainingUnits <= 0) break;
			const reserved = reservations.get(orb.globalIndex) ?? 0;
			const assigned = Math.min(
				remainingUnits,
				Math.max(0, ORB_REQUIRED_UNITS - reserved),
			);
			if (assigned === 0) continue;
			reservations.set(orb.globalIndex, reserved + assigned);
			remainingUnits -= assigned;
		}
	}
	return reservations;
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
): PickupAssignments => {
	const byPlayer = new Map<string, PickupWithOrb[]>();
	const unassigned: InsatiableUnassignedPlayerApplication[] = [];
	const mechanic = report.mechanics?.find(
		(candidate) => candidate.name === INSATIABLE_APPLICATION_MECHANIC,
	);

	for (const event of mechanic?.mechanicsData ?? []) {
		const stackTransition = getInsatiableStackTransition(
			report,
			event.actor,
			event.time,
		);
		const playerPosition = getPlayerPosition(report, event.actor, event.time);
		if (!playerPosition) {
			unassigned.push({
				player: event.actor,
				time: event.time,
				stackDelta: stackTransition.stackDelta,
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
				stackDelta: stackTransition.stackDelta,
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
					stackDelta: stackTransition.stackDelta,
					reason: "ambiguous-orb",
				});
				continue;
			}
		}

		const pickup: PickupWithOrb = {
			orbKey: assignedCandidate.orb.globalIndex,
			player: event.actor,
			time: event.time,
			...stackTransition,
			distance: assignedCandidate.distance,
			attribution,
			confirmed: true,
		};
		const { orbKey: _orbKey, ...publicPickup } = pickup;
		assignedCandidate.orb.playerPickups.push(publicPickup);
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
		if (orb.playerPickups.some((pickup) => pickup.player === player.name)) {
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
		orb.deletedBy = {
			player: best.player,
			time: best.time,
			priorPickupTime: best.priorPickupTime,
			priorOrbIndex: best.priorOrbIndex,
			evidence: best.evidence,
		};
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
		if (orb.playerPickups.some((pickup) => pickup.player === player.name)) {
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
		orb.deletedBy = {
			player: best.player,
			time: best.time,
			priorPickupTime: best.priorPickupTime,
			priorOrbIndex: best.priorOrbIndex,
			evidence: best.evidence,
		};
	}
	return unique;
};

const getPlayerUnits = (orb: InsatiableOrb) =>
	orb.playerPickups.reduce((total, pickup) => total + pickup.stackDelta, 0);

const getActorUnits = (orb: InsatiableOrb) =>
	orb.empoweredTransitions.reduce(
		(total, transition) => total + (transition.assignedUnits ?? 0),
		0,
	);

/**
 * A late Insatiable event cannot belong to an orb that an eligible player had
 * already deleted. Move it to a uniquely matching, recently-ended orb. This
 * resolves coupled races where the deleting player reaches the next path
 * before EI emits another player's application.
 */
const reconcilePickupsAfterDeletion = (
	report: DpsReportJson,
	orbs: OrbWithDecoration[],
	assignments: PickupAssignments,
	empoweredReservations: ProvisionalEmpoweredReservations,
) => {
	let changed = false;
	const pollingRate = report.combatReplayMetaData.pollingRate;

	for (const sourceOrb of orbs) {
		if (sourceOrb.deletedBy?.evidence !== "terminal-contact") continue;
		const invalidPickups = sourceOrb.playerPickups.filter(
			(pickup) => pickup.time > (sourceOrb.deletedBy?.time ?? Infinity),
		);
		for (const invalidPickup of invalidPickups) {
			const internalPickup = assignments.byPlayer
				.get(invalidPickup.player)
				?.find(
					(pickup) =>
						pickup.orbKey === sourceOrb.globalIndex &&
						pickup.time === invalidPickup.time,
				);
			if (!internalPickup) continue;

			const alternatives = orbs
				.filter(
					(orb) =>
						orb.globalIndex !== sourceOrb.globalIndex &&
						hasUnreservedPlayerCapacity(
							orb,
							empoweredReservations,
						) &&
						!orb.playerPickups.some(
							(pickup) => pickup.player === invalidPickup.player,
						) &&
						invalidPickup.time >= orb.endTime &&
						invalidPickup.time - orb.endTime <=
							DELAYED_PICKUP_EVENT_WINDOW_MS,
				)
				.map((orb) => {
					const contactStart = Math.max(
						orb.spawnTime,
						invalidPickup.time - DELAYED_PICKUP_EVENT_WINDOW_MS,
					);
					let closest: { time: number; distance: number } | null = null;
					for (
						let time = Math.ceil(contactStart / pollingRate) * pollingRate;
						time <= orb.endTime;
						time += pollingRate
					) {
						const playerPosition = getPlayerPosition(
							report,
							invalidPickup.player,
							time,
						);
						const orbPosition = getOrbPosition(orb.decoration, time);
						if (!playerPosition || !orbPosition) continue;
						const currentDistance = distance(playerPosition, orbPosition);
						if (!closest || currentDistance < closest.distance) {
							closest = { time, distance: currentDistance };
						}
					}
					const terminalPlayerPosition = getPlayerPosition(
						report,
						invalidPickup.player,
						orb.endTime,
					);
					const terminalOrbPosition = getOrbPosition(
						orb.decoration,
						orb.endTime,
					);
					if (terminalPlayerPosition && terminalOrbPosition) {
						const terminalDistance = distance(
							terminalPlayerPosition,
							terminalOrbPosition,
						);
						if (!closest || terminalDistance < closest.distance) {
							closest = { time: orb.endTime, distance: terminalDistance };
						}
					}
					return closest &&
						closest.distance <= CONFIRMED_PICKUP_CONTACT_RADIUS
						? {
								orb,
								contact: closest,
								terminalDelta: invalidPickup.time - orb.endTime,
							}
						: null;
				})
				.filter(
					(candidate): candidate is {
						orb: OrbWithDecoration;
						contact: { time: number; distance: number };
						terminalDelta: number;
					} => candidate !== null,
				)
				.sort(
					(a, b) =>
						a.terminalDelta - b.terminalDelta ||
						a.contact.distance - b.contact.distance,
				);
			const best = alternatives[0];
			const runnerUp = alternatives[1];
			if (
				!best ||
				(runnerUp &&
					runnerUp.terminalDelta - best.terminalDelta < pollingRate)
			) {
				continue;
			}

			const sourceIndex = sourceOrb.playerPickups.indexOf(invalidPickup);
			if (sourceIndex < 0) continue;
			sourceOrb.playerPickups.splice(sourceIndex, 1);
			best.orb.playerPickups.push({
				...invalidPickup,
				distance: best.contact.distance,
				attribution: "terminal-time",
			});
			internalPickup.orbKey = best.orb.globalIndex;
			internalPickup.distance = best.contact.distance;
			internalPickup.attribution = "terminal-time";
			changed = true;
		}
	}

	return changed;
};

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
					(orb.deletedBy?.evidence !== "terminal-contact" ||
						transition.time < orb.deletedBy.time ||
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
			orb.empoweredTransitions.push({ ...transition, assignedUnits });
			remainingUnits -= assignedUnits;
		}
		unassignedUnits += remainingUnits;
	}
	return unassignedUnits;
};

/**
 * Resolve overlapping orb paths using the actor ledger. A pickup that was
 * assigned by nearest position can be closer to the wrong orb when two paths
 * cross. If the other orb has a terminal Empowered transition and the player
 * is also in contact with it, moving that pickup is stronger than retaining a
 * player deletion on an orb that was absorbed by an actor.
 */
const reconcilePickupsWithActorAbsorption = (
	report: DpsReportJson,
	orbs: OrbWithDecoration[],
	assignments: PickupAssignments,
) => {
	let changed = false;
	for (const targetOrb of orbs) {
		if (!targetOrb.empoweredTransitions.length) continue;
		if (
			getPlayerUnits(targetOrb) + getActorUnits(targetOrb) >=
			ORB_REQUIRED_UNITS
		)
			continue;
		const deletionPlayer = targetOrb.deletedBy?.player;
		if (!deletionPlayer) continue;

		const candidates = orbs.flatMap((sourceOrb) => {
			if (sourceOrb.globalIndex === targetOrb.globalIndex) return [];
			return sourceOrb.playerPickups
				.filter((pickup) => pickup.player === deletionPlayer)
				.flatMap((pickup) => {
					if (
						pickup.distance !== null &&
						pickup.distance <= DIRECT_PICKUP_LOCK_RADIUS
					)
						return [];
				const start = Math.max(
					targetOrb.spawnTime,
					pickup.time,
					targetOrb.endTime - TERMINAL_TOUCH_WINDOW_MS,
				);
				const end = Math.min(
					targetOrb.endTime,
					pickup.time + DUPLICATE_TOUCH_WINDOW_MS,
				);
				if (start > end) return [];
				const playerPosition = getPlayerPosition(
					report,
					pickup.player,
					end,
				);
				const orbPosition = getOrbPosition(targetOrb.decoration, end);
				if (!playerPosition || !orbPosition) return [];
				const pickupDistance = distance(playerPosition, orbPosition);
				return pickupDistance <= PLAYER_ORB_CONTACT_RADIUS
					? [{ sourceOrb, pickup, pickupDistance }]
					: [];
				});
		});

		const best = candidates.sort(
			(a, b) => a.pickupDistance - b.pickupDistance,
		)[0];
		if (!best) continue;

		const sourcePickupIndex = best.sourceOrb.playerPickups.indexOf(best.pickup);
		if (sourcePickupIndex < 0) continue;
		best.sourceOrb.playerPickups.splice(sourcePickupIndex, 1);
		targetOrb.playerPickups.push({
			...best.pickup,
			distance: best.pickupDistance,
			attribution: "position",
		});
		const internalPickup = assignments.byPlayer
			.get(best.pickup.player)
			?.find(
				(candidate) =>
					candidate.orbKey === best.sourceOrb.globalIndex &&
					candidate.time === best.pickup.time,
			);
		if (internalPickup) {
			internalPickup.orbKey = targetOrb.globalIndex;
			internalPickup.distance = best.pickupDistance;
			internalPickup.attribution = "position";
		}
		changed = true;
	}
	return changed;
};

/** Move an over-counted player pickup off an actor-absorbed orb when the
 * deletion candidate identifies the only valid destination orb. */
const reconcileOverfilledActorOrb = (
	report: DpsReportJson,
	orbs: OrbWithDecoration[],
	assignments: PickupAssignments,
) => {
	let changed = false;
	for (const actorOrb of orbs) {
		if (!actorOrb.empoweredTransitions.length) continue;
		if (getPlayerUnits(actorOrb) + getActorUnits(actorOrb) <= ORB_REQUIRED_UNITS) {
			continue;
		}

		for (const destinationOrb of orbs) {
			const deletionPlayer = destinationOrb.deletedBy?.player;
			if (
				destinationOrb.globalIndex === actorOrb.globalIndex ||
				!deletionPlayer ||
				getPlayerUnits(destinationOrb) >= ORB_REQUIRED_UNITS
			)
				continue;
			const pickup = actorOrb.playerPickups.find(
				(candidate) => candidate.player === deletionPlayer,
			);
			if (!pickup) continue;
			const playerPosition = getPlayerPosition(
				report,
				pickup.player,
				pickup.time,
			);
			const orbPosition = getOrbPosition(destinationOrb.decoration, pickup.time);
			if (!playerPosition || !orbPosition) continue;
			if (distance(playerPosition, orbPosition) > PLAYER_ORB_CONTACT_RADIUS) {
				continue;
			}

			const pickupIndex = actorOrb.playerPickups.indexOf(pickup);
			if (pickupIndex < 0) continue;
			actorOrb.playerPickups.splice(pickupIndex, 1);
			destinationOrb.playerPickups.push({
				...pickup,
				distance: distance(playerPosition, orbPosition),
				attribution: "position",
			});
			const internalPickup = assignments.byPlayer
				.get(pickup.player)
				?.find(
					(candidate) =>
						candidate.orbKey === actorOrb.globalIndex &&
						candidate.time === pickup.time,
				);
			if (internalPickup) {
				internalPickup.orbKey = destinationOrb.globalIndex;
				internalPickup.attribution = "position";
			}
			changed = true;
			break;
		}
	}
	return changed;
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
	orb: InsatiableOrb,
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
	accounting.playerInsatiableUnits = playerInsatiableUnits;
	accounting.actorEmpoweredUnits = actorEmpoweredUnits;
	const crossedActorBeforeDeletion = orb.deletedBy
		? crossedSourceActorBefore(report, orb, cast, orb.deletedBy.time)
		: false;
	const lateDeletingPlayerApplication = orb.deletedBy
		? hasInsatiableApplicationAfterContact(
				report,
				orb.deletedBy.player,
				orb.deletedBy.time,
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
		orb.deletedBy?.evidence === "terminal-contact" &&
		remainingUnits > 0
	) {
		orb.outcome = "player-deleted";
		accounting.deletedUnits = remainingUnits;
		const deletionTouch = orb.inferredTouches.find(
			(touch) =>
				touch.player === orb.deletedBy?.player &&
				touch.time === orb.deletedBy.time &&
				touch.priorPickupTime === orb.deletedBy.priorPickupTime,
		);
		if (deletionTouch) {
			orb.deletionEvidence = {
				priorInsatiableConfirmed: true,
				noTargetInsatiableApplication: true,
				noActorEmpoweredTransition: true,
				uniqueTerminalContact: true,
				actorPathClear: true,
				priorPickupDeltaMs:
					orb.deletedBy.time - orb.deletedBy.priorPickupTime,
				terminalDeltaMs: orb.endTime - orb.deletedBy.time,
				contactDistance: deletionTouch.distance,
			};
		}
	} else if (observedUnits >= ORB_REQUIRED_UNITS) {
		// A fully observed three-unit ledger disproves any positional deletion
		// candidate produced by overlapping terminal paths.
		delete orb.deletedBy;
		orb.inferredTouches = [];
		const actorTransition = orb.empoweredTransitions[0];
		if (actorTransition?.target === "Cerus") {
			orb.absorbedBy = "Cerus";
			orb.absorptionEvidence = "empowered-stack";
			orb.outcome = "cerus-absorbed";
		} else if (actorTransition) {
			orb.absorbedBy = actorTransition.target;
			orb.absorptionEvidence = "empowered-stack";
			orb.outcome = "embodiment-absorbed";
		} else {
			orb.outcome = "player-collected";
		}
	} else {
		if (phaseDespawnedAt !== undefined) {
			orb.phaseDespawnedAt = phaseDespawnedAt;
			orb.outcome = "phase-despawned";
			accounting.phaseDespawnedUnits = remainingUnits;
		} else if (mechanicEnded) {
			orb.outcome = "mechanic-ended";
			accounting.mechanicEndedUnits = remainingUnits;
		} else if (isSplit2BugDespawn(cast, orb, observedUnits)) {
			// This is the repeated Split 2 state observed in E9oq, gSd6, Mwij,
			// and QwN7: one of the five large-orb decorations has no player
			// application, no eligible duplicate touch, and no Empowered transition.
			// It disappears mid-path before the phase ends.
			orb.outcome = "split-2-bug-despawn";
			accounting.split2BugDespawnUnits = remainingUnits;
		} else {
			orb.outcome = "unresolved";
			orb.unresolvedReason = actorEmpoweredUnits > 0
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
	}

	if (orb.outcome !== "unresolved") accounting.unresolvedUnits = 0;
	accounting.accountedUnits =
		accounting.playerInsatiableUnits +
		accounting.actorEmpoweredUnits +
		accounting.deletedUnits +
		accounting.phaseDespawnedUnits +
		accounting.mechanicEndedUnits +
		accounting.split2BugDespawnUnits;
	accounting.isBalanced = accounting.accountedUnits === accounting.requiredUnits;
	orb.accounting = accounting;
	orb.collectionCount = observedUnits;
	orb.collectionState = getCollectionState(observedUnits);
};

const toPublicOrb = ({
	decoration: _decoration,
	globalIndex: _globalIndex,
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
			playerInsatiableUnits:
				total.playerInsatiableUnits + orb.accounting.playerInsatiableUnits,
			actorEmpoweredUnits:
				total.actorEmpoweredUnits + orb.accounting.actorEmpoweredUnits,
			deletedUnits: total.deletedUnits + orb.accounting.deletedUnits,
			phaseDespawnedUnits:
				total.phaseDespawnedUnits + orb.accounting.phaseDespawnedUnits,
			mechanicEndedUnits:
				total.mechanicEndedUnits + orb.accounting.mechanicEndedUnits,
			split2BugDespawnUnits:
				total.split2BugDespawnUnits + orb.accounting.split2BugDespawnUnits,
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

export const trackInsatiableHungerOrbs = (
	report: DpsReportJson,
	combatReplay: CombatReplayJson | null | undefined,
): InsatiableHungerDetails => {
	if (!combatReplay) {
		return {
			casts: [],
			unassignedOrbs: [],
			empoweredTransitions: [],
			unassignedPlayerApplications: [],
			accounting: summarizeAccounting([], [], 0),
		};
	}

	const casts = getHungerCasts(report);
	const orbs = getLargeOrbDecorations(combatReplay)
		.sort((a, b) => a.start - b.start)
		.map((decoration, index) => createOrb(decoration, index))
		.filter((orb): orb is OrbWithDecoration => orb !== null);
	const empoweredTransitions = getEmpoweredTransitions(report);
	const empoweredReservations = reserveDirectEmpoweredUnits(
		orbs,
		empoweredTransitions,
	);
	const pickupAssignments = assignPickupEvents(
		report,
		orbs,
		empoweredReservations,
	);
	const inferTouches = () => {
		for (const orb of orbs) {
			orb.inferredTouches = [];
			delete orb.deletedBy;
			orb.inferredTouches = inferTerminalTouches(
				report,
				orb,
				pickupAssignments.byPlayer,
			);
		}
	};
	inferTouches();
	for (let pass = 0; pass < 2; pass += 1) {
		if (
			!reconcilePickupsAfterDeletion(
				report,
				orbs,
				pickupAssignments,
				empoweredReservations,
			)
		) {
			break;
		}
		inferTouches();
	}

	const unassignedEmpoweredUnits = assignEmpoweredTransitions(
		orbs,
		empoweredTransitions,
	);
	if (
		reconcilePickupsWithActorAbsorption(report, orbs, pickupAssignments) ||
		reconcileOverfilledActorOrb(report, orbs, pickupAssignments)
	) {
		inferTouches();
	}
	for (const orb of orbs) {
		if (
			getPlayerUnits(orb) + getActorUnits(orb) >= ORB_REQUIRED_UNITS ||
			orb.inferredTouches.length > 0
		) {
			continue;
		}
		orb.inferredTouches = inferCausalTouches(
			report,
			orb,
			pickupAssignments.byPlayer,
		);
	}
	const assignedOrbKeys = new Set<number>();
	for (const orb of orbs) {
		const cast = casts
			.map((candidate) => ({
				candidate,
				delta: Math.abs(candidate.castTime - orb.spawnTime),
			}))
			.filter(({ delta }) => delta <= CAST_ORB_ASSIGNMENT_WINDOW_MS)
			.sort((a, b) => a.delta - b.delta)[0]?.candidate;
		if (!cast) continue;
		cast.orbs.push(orb);
		assignedOrbKeys.add(orb.globalIndex);
	}

	for (const cast of casts) {
		cast.orbs.sort((a, b) => a.spawnTime - b.spawnTime);
		cast.orbs.forEach((orb, index) => {
			orb.index = index;
			resolveOutcome(report, orb, cast);
		});
	}
	const unassignedOrbs = orbs
		.filter((orb) => !assignedOrbKeys.has(orb.globalIndex))
		.map((orb) => {
			resolveOutcome(report, orb, undefined);
			return toPublicOrb(orb);
		});
	const publicCasts = casts.map((cast) => ({
		...cast,
		orbs: cast.orbs.map(toPublicOrb),
	}));
	const publicOrbs = [
		...publicCasts.flatMap((cast) => cast.orbs),
		...unassignedOrbs,
	];

	return {
		casts: publicCasts,
		unassignedOrbs,
		empoweredTransitions,
		unassignedPlayerApplications: pickupAssignments.unassigned,
		accounting: summarizeAccounting(
			publicOrbs,
			pickupAssignments.unassigned,
			unassignedEmpoweredUnits,
		),
	};
};
