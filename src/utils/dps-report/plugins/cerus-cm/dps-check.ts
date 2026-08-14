import type { CustomMetricDefinition, ThresholdStep } from "../../../../types";
import type { mapDpsReport } from "../../mapper";

type TMappedReport = ReturnType<typeof mapDpsReport>;

const ID = "25989.cerus-cm.dps-check";

const thresholds = {
	cm: {
		latePhase: 165000,
		secondGreen: 176000, // UNSURE
		firstGreen: 181000,
	},
	lcm: {
		latePhase: 203000,
		secondGreen: 218000, // UNSURE
		firstGreen: 223000,
	},
};

const generateThresholds = (type: "cm" | "lcm"): ThresholdStep[] => {
	const t = thresholds[type];

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
	id: ID,
	name: "Phase 3 DPS",
	aggregation: "AVG",
	displayType: "SCALAR",
	placement: "BOTH",
	thresholds: {
		operator: "<",
		defaultColor: "none",
		cm: generateThresholds("cm"),
		lcm: generateThresholds("lcm"),
	},
};

export const parseDpsCheckMetric = (mapped: TMappedReport) => {
	// 1. Find the target phase index ("50%-10%" or "Phase 3" as fallback)
	let targetPhaseIndex = mapped.phases.findIndex((p) => p.name === "50%-10%");
	if (targetPhaseIndex === -1) {
		targetPhaseIndex = mapped.phases.findIndex((p) => p.name === "Phase 3");
	}

	if (targetPhaseIndex !== -1) {
		const targetPhase = mapped.phases[targetPhaseIndex];

		if (!targetPhase) return mapped; // Safety check

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
		let totalDamage = 0;
		for (const player of mapped.players) {
			const playerPhaseStats = player.phases[targetPhaseIndex];
			if (!playerPhaseStats?.targets) continue;

			for (const tIndex of validTargetIndices) {
				const targetStats = playerPhaseStats.targets[tIndex];
				if (targetStats) {
					totalDamage += targetStats.damage;
				}
			}
		}

		// 4. Calculate DPS
		const durationSec = (targetPhase.end - targetPhase.start) / 1000;
		const squadDps = durationSec > 0 ? totalDamage / durationSec : 0;

		mapped.customMetrics[ID] = {
			dataType: "scalar",
			value: squadDps,
		};
	}

	return mapped;
};
