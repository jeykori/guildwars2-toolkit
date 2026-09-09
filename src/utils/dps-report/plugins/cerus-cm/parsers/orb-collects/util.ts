import type {
	CombatReplayJson,
	DecorationRendering,
	DpsReportJson,
} from "../../../../../../types";
import { LARGE_ORB_DECORATION_SIGNATURE } from "./constants";
import type {
	InsatiableOrb,
	InsatiableOrbEvent,
	InsatiableOrbPosition,
} from "./types";

export const getPlayerUnits = (orb: InsatiableOrb) => pickupEvents(orb).length;
export const getActorUnits = (orb: InsatiableOrb) =>
	empoweredEvents(orb).reduce(
		(total, transition) => total + (transition.assignedUnits ?? 0),
		0,
	);

export const pickupEvents = (orb: InsatiableOrb) =>
	orb.events.filter(
		(event): event is Extract<InsatiableOrbEvent, { type: "pickup" }> =>
			event.type === "pickup",
	);

export const empoweredEvents = (orb: InsatiableOrb) =>
	orb.events.filter(
		(event): event is Extract<InsatiableOrbEvent, { type: "empowered" }> =>
			event.type === "empowered",
	);

export const deleteEvent = (orb: InsatiableOrb) =>
	orb.events.find(
		(event): event is Extract<InsatiableOrbEvent, { type: "delete" }> =>
			event.type === "delete",
	);

export const getInterpolatedPlayerPosition = (
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

export const getInterpolatedActorPosition = (
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
export const getOrbPosition = (
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

export const getLargeOrbDecorations = (combatReplay: CombatReplayJson) =>
	combatReplay.decorationRenderings.filter((decoration) => {
		if (decoration.metadataSignature === LARGE_ORB_DECORATION_SIGNATURE) {
			return true;
		}
		const metadata = combatReplay.decorationMetadata.find(
			(candidate) => candidate.signature === decoration.metadataSignature,
		);
		return metadata?.type === 2 && metadata.radius === 30;
	});
