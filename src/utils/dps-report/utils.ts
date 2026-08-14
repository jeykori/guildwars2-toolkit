import type { DpsReportJson } from "../../types";

export const getEuclideanDist = (
	p1: readonly [number, number],
	p2: readonly [number, number],
) => Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);

export const getPlayerPosition = (
	actor: string,
	time: number,
	report: DpsReportJson,
): [number, number] | null => {
	const player = report.players.find((p) => p.name === actor);

	const combatReplay = player?.combatReplayData;

	if (!combatReplay) return null;

	if (combatReplay.positions.length === 0) {
		return null;
	}

	const pollingRate = report.combatReplayMetaData.pollingRate;

	// Derived from the documentation formula:
	// time = Math.ceil(start / pollingRate) * pollingRate + i * pollingRate
	// i = (time - (Math.ceil(start / pollingRate) * pollingRate)) / pollingRate
	const baseTime = Math.ceil(combatReplay.start / pollingRate) * pollingRate;
	let index = Math.round((time - baseTime) / pollingRate);

	// Clamp the index to prevent out-of-bounds errors if the time is beyond the recorded data
	if (index < 0) {
		index = 0;
	} else if (index >= combatReplay.positions.length) {
		index = combatReplay.positions.length - 1;
	}

	return combatReplay.positions[index] ?? null;
};
