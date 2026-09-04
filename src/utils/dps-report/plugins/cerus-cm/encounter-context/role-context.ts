import type { DpsReportJson, EncounterPlugin } from "../../../../../types";
import { BUFF_IDS } from "../../../constants";
import type { CerusEncounterContext } from "../types";

/**
 * Assumes standard composition:
 * - 6 DPS
 * - 2 BoonDPS
 * - 2 Healers (lowest damage)
 */
export const getRoleContext = (
	logData: DpsReportJson,
	mapped: Parameters<EncounterPlugin["parseLog"]>[2],
): CerusEncounterContext["roles"] => {
	let fullFightPhaseIndex = logData.phases.findIndex(
		(p) => p.name === "Full Fight",
	);

	if (fullFightPhaseIndex === -1) {
		fullFightPhaseIndex = 0;
	}

	const fullFightPhase = logData.phases[fullFightPhaseIndex];

	if (!fullFightPhase) {
		return { heal: [], boondps: [] };
	}

	const validTargetIndices = new Set<number>();
	for (const [targetIndexStr, priority] of Object.entries(
		fullFightPhase.targetPriorities,
	)) {
		if (priority === "MAIN" || priority === "BLOCKING") {
			validTargetIndices.add(Number(targetIndexStr));
		}
	}

	const durationSec = (fullFightPhase.end - fullFightPhase.start) / 1000;

	// 1. Calculate all player DPS and store for sorting
	const playerStats: { account: string; dps: number }[] = [];

	for (const player of mapped.players) {
		const playerPhaseStats = player.phases[fullFightPhaseIndex];
		let playerDamage = 0;

		for (const tIndex of validTargetIndices) {
			playerDamage += playerPhaseStats?.targets?.[tIndex]?.damage ?? 0;
		}

		const playerDps = durationSec > 0 ? playerDamage / durationSec : 0;

		playerStats.push({
			account: player.account,
			dps: playerDps,
		});
	}

	// Sort by DPS ascending (lowest to highest)
	playerStats.sort((a, b) => a.dps - b.dps);

	// 2. Assume the bottom 2 are the healers
	const heal = playerStats.slice(0, 2).map((p) => p.account);

	// 3. Find Boon DPS from the remaining 8 players
	const nonHealers = playerStats.slice(2);

	const getBoonGenerationScore = (account: string): number => {
		const rawPlayer = logData.players.find((p) => p.account === account);
		if (!rawPlayer) return 0;

		const quick = getGroupBuffGeneration(
			BUFF_IDS.QUICKNESS,
			rawPlayer,
			fullFightPhaseIndex,
		);
		const alacrity = getGroupBuffGeneration(
			BUFF_IDS.ALACRITY,
			rawPlayer,
			fullFightPhaseIndex,
		);
		return Math.max(quick, alacrity);
	};

	// Sort the remaining players by how much squad boons they generated (highest to lowest)
	nonHealers.sort(
		(a, b) =>
			getBoonGenerationScore(b.account) - getBoonGenerationScore(a.account),
	);

	// Assume the top 2 boon generators among the non-healers are the Boon DPS
	const boondps = nonHealers.slice(0, 2).map((p) => p.account);

	return {
		heal,
		boondps,
	};
};

const getGroupBuffGeneration = (
	buffId: number,
	player: DpsReportJson["players"][number],
	phaseIndex: number,
) => {
	return (
		player.groupBuffsActive.find((b) => b.id === buffId)?.buffData?.[phaseIndex]
			?.generation ?? 0
	);
};
