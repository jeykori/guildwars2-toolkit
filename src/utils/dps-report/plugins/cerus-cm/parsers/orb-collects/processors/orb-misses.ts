import type { DpsReportJson } from "../../../../../../../types";
import {
	DELAYED_EMPOWERED_EVENT_WINDOW_MS,
	EMPOWERED_APPLICATION_MECHANIC,
	EVENT_CORRELATION_WINDOW_MS,
	HUNGER_TARGET_IDS,
	ORB_REQUIRED_UNITS,
	RAGE_HIT_MECHANIC,
} from "../constants";
import type {
	InsatiableEmpoweredTransition,
	TrackedInsatiableOrb,
} from "../types";
import { getActorUnits, getPlayerUnits } from "../util";

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
			.sort(
				(a, b) => Math.abs(a.time - hit.time) - Math.abs(b.time - hit.time),
			)[0];
		if (rageApplication) excluded.add(rageApplication);
	}

	return events
		.filter((event) => !excluded.has(event))
		.map((event) => ({
			target: event.actor,
			source: EMPOWERED_APPLICATION_MECHANIC,
			time: event.time,
		}))
		.sort((a, b) => a.time - b.time);
};

export const assignEmpoweredTransitions = (
	orbs: TrackedInsatiableOrb[],
	transitions: InsatiableEmpoweredTransition[],
) => {
	for (const transition of transitions) {
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
			const capacity =
				ORB_REQUIRED_UNITS - getPlayerUnits(orb) - getActorUnits(orb);

			if (capacity > 0) {
				// Look at the most recent event on this orb's ledger
				const lastEvent = orb.events[orb.events.length - 1];

				// Group simultaneous boss absorptions into a single ledger entry
				if (
					lastEvent?.type === "empowered" &&
					lastEvent.time === transition.time
				) {
					lastEvent.assignedUnits += 1;
				} else {
					orb.events.push({
						type: "empowered",
						...transition,
						assignedUnits: 1,
					});
				}

				break; // Unit successfully assigned, move to the next transition
			}
		}
	}
};
