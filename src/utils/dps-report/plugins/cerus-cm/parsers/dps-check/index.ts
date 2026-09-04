import type {
	CustomMetricDefinition,
	ThresholdStep,
} from "../../../../../../types";
import type { CerusLogDetails, CerusPlugin, CerusSubParser } from "../../types";
import type { DpsCheck, DpsCheckRole } from "./types";

export const CERUS_CM_DPS_CHECK_ID = "25989.cerus-cm.dps-check";

export const CERUS_CM_THRESHOLDS = {
	cm: {
		latePhase: 165000,
		secondGreen: 181000,
		firstGreen: 213000,
	},
	lcm: {
		latePhase: 203000,
		secondGreen: 223000,
		firstGreen: 260000,
	},
};

export const CERUS_CM_DPS_TARGETS = {
	cm: {
		dps: 24000,
		boondps: 18500,
		heal: 0,
	},
	lcm: {
		dps: 29500,
		boondps: 23000,
		heal: 0,
	},
} as const satisfies Record<string, Record<DpsCheckRole, number>>;

const generateThresholds = (type: "cm" | "lcm"): ThresholdStep[] => {
	const t = CERUS_CM_THRESHOLDS[type];

	return [
		{
			value: t.latePhase,
			color: "red",
			description: "🔴 DPS Check Failed",
			tooltip: `Minimum DPS: ${t.latePhase.toLocaleString()}`,
		},
		{
			value: t.secondGreen,
			color: "orange",
			description: "🟢 Late Phasing",
			tooltip: `Late Phasing DPS: ${t.latePhase.toLocaleString()} - ${t.secondGreen.toLocaleString()}`,
		},
		{
			value: t.firstGreen,
			color: "yellow",
			description: "🟢 Second Green Phasing",
			tooltip: `Second Green DPS: ${t.secondGreen.toLocaleString()} - ${t.firstGreen.toLocaleString()}`,
		},
		{
			value: 999999,
			color: "green",
			description: "🟢 First Green Phashing",
			tooltip: `Green Phashing: ${t.firstGreen.toLocaleString()}`,
		},
	];
};

export const dpsCheckMetric: CustomMetricDefinition = {
	id: CERUS_CM_DPS_CHECK_ID,
	name: "Phase 3 DPS",
	aggregation: "AVG",
	displayType: "SCALAR",
	thresholds: {
		operator: "<",
		defaultColor: "none",
		cm: generateThresholds("cm"),
		lcm: generateThresholds("lcm"),
	},
};

export const parseDpsCheckMetric: CerusSubParser = (
	report,
	_combatReplay,
	mapped,
	context,
) => {
	// Only for CM/LCM
	if (!report.isCM && !report.isLegendaryCM) {
		return mapped;
	}

	// 1. Find the target phase index ("50%-10%" or "Phase 3" as fallback)
	let targetPhaseIndex = mapped.phases.findIndex((p) => p.name === "50%-10%");
	if (targetPhaseIndex === -1) {
		targetPhaseIndex = mapped.phases.findIndex((p) => p.name === "Phase 3");
	}

	if (targetPhaseIndex !== -1) {
		const targetPhase = mapped.phases[targetPhaseIndex];
		if (!targetPhase) return mapped;

		// Initialize our specific log details object
		mapped.encounterDetails ??= {};
		mapped.encounterDetails.dpsCheck ??= {};

		const mode = mapped.isLegendaryCM ? "lcm" : "cm";
		const targets = CERUS_CM_DPS_TARGETS[mode];

		// 2. Find target priorities for this phase that are MAIN or BLOCKING
		const validTargetIndices = new Set<number>();
		for (const [targetIndexStr, priority] of Object.entries(
			targetPhase.targetPriorities,
		)) {
			if (priority === "MAIN" || priority === "BLOCKING") {
				validTargetIndices.add(Number(targetIndexStr));
			}
		}

		// 3. Sum the damage for these targets across all players
		const durationSec = (targetPhase.end - targetPhase.start) / 1000;
		let totalDamage = 0;

		for (const player of mapped.players) {
			const playerPhaseStats = player.phases[targetPhaseIndex];
			let playerDamage = 0;

			for (const tIndex of validTargetIndices) {
				playerDamage += playerPhaseStats?.targets?.[tIndex]?.damage ?? 0;
			}

			totalDamage += playerDamage;

			// 4. Calculate individual player DPS and populate details
			if (durationSec > 0) {
				const playerDps = playerDamage / durationSec;

				const role: DpsCheckRole = context.roles.boondps.includes(
					player.account,
				)
					? "boondps"
					: context.roles.heal.includes(player.account)
						? "heal"
						: "dps";
				const targetDps = targets[role];

				mapped.encounterDetails.dpsCheck[player.account] = {
					role,
					dps: playerDps,
					targetDps,
					passed: playerDps >= targetDps,
				};
			}
		}

		// 5. Calculate overall Squad DPS
		const squadDps = durationSec > 0 ? totalDamage / durationSec : 0;

		mapped.customSummaryMetrics[CERUS_CM_DPS_CHECK_ID] = {
			dataType: "scalar",
			value: squadDps,
		};
	}

	return mapped;
};

export const aggregateDpsChecks: CerusPlugin["aggregateDetails"] = (
	_players,
	logs,
) => {
	const combinedDpsCheck: DpsCheck = {};
	const counts: Record<string, number> = {};

	for (const log of logs) {
		const logDpsCheck = (log.encounterDetails as CerusLogDetails)?.dpsCheck;
		if (!logDpsCheck) continue;

		for (const [account, check] of Object.entries(logDpsCheck)) {
			let target = combinedDpsCheck[account];
			if (!target) {
				target = {
					role: check.role,
					passed: false, // Calculated at the end
					dps: 0,
					targetDps: check.targetDps,
				};
				combinedDpsCheck[account] = target;
			}

			target.dps += check.dps;

			// Safely initialize to 0 if undefined, then add 1
			counts[account] = (counts[account] ?? 0) + 1;
		}
	}

	// Calculate averages and final pass/fail state
	for (const [account, target] of Object.entries(combinedDpsCheck)) {
		// Safely fallback to 0
		const count = counts[account] ?? 0;

		if (count > 0) {
			target.dps = target.dps / count;
			target.passed = target.dps >= target.targetDps;
		}
	}

	return { dpsCheck: combinedDpsCheck };
};
