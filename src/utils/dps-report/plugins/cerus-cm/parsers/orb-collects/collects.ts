import type { DpsReportJson } from "../../../../../../types/dps-report/elite-insights";
import {
	COLLECT_SEARCH_PADDING_MS,
	EXPECTED_COLLECT_MATCH_TOLERANCE_MS,
	HUNGER_SKILL_IDS,
	HUNGER_TARGET_IDS,
} from "./constants";
import type {
	ExpectedCollect,
	ExpectedPhaseCollect,
	InsatiableHungerRawCast,
	InsatiableHungerRawCollect,
} from "./types";

const p1Collects: ExpectedPhaseCollect[] = [
	{ name: "p1-1_cerus", phase: "Phase 1", times: [51] },
];

const p2Collects: ExpectedPhaseCollect[] = [
	{
		name: "p2-1_double-collect",
		phase: "Phase 2",
		times: [34, 44],
	},
	{ name: "p2-2_cerus", phase: "Phase 2", times: [112] },
];

const p3Collects: ExpectedPhaseCollect[] = [
	{
		name: "p3-1_double-collect",
		phase: "Phase 3",
		times: [24, 30],
	},
	{ name: "p3-2_bad-collect_cerus", phase: "Phase 3", times: [97] },
	{ name: "p3-3_rage_embodiment", phase: "Phase 3", times: [114] },
	{ name: "p3-4_cerus", phase: "Phase 3", times: [164] },
	{
		name: "p3-5_green-phase_embodiment",
		phase: "Phase 3",
		times: [204],
	},
];

export const EXPECTED_COLLECTS: ExpectedCollect[] = [
	...p1Collects,
	{ name: "split-1", phase: "Split 1" },
	...p2Collects,
	{ name: "split-2", phase: "Split 2" },
	...p3Collects,
];

const normalSkills = new Set<number>(HUNGER_SKILL_IDS.normal);
const empoweredSkills = new Set<number>(HUNGER_SKILL_IDS.empowered);
const hungerTargets = new Set<number>(HUNGER_TARGET_IDS);

const isPhaseCollect = (
	collect: ExpectedCollect,
): collect is ExpectedPhaseCollect => "times" in collect;

export const matchExpectedCollects = (
	report: DpsReportJson,
	expectedCollects = EXPECTED_COLLECTS,
): {
	rawCollects: InsatiableHungerRawCollect[];
	casts: InsatiableHungerRawCast[];
} => {
	const casts: InsatiableHungerRawCast[] = [];
	for (const target of report.targets) {
		if (!hungerTargets.has(target.id)) continue;
		for (const rotation of target.rotation) {
			const expectedOrbCount = normalSkills.has(rotation.id)
				? 3
				: empoweredSkills.has(rotation.id)
					? 5
					: null;
			if (expectedOrbCount === null) continue;
			for (const skill of rotation.skills) {
				casts.push({
					source: target.name,
					targetId: target.id,
					skillId: rotation.id,
					castTime: skill.castTime,
					endTime: skill.castTime + skill.duration,
					expectedOrbCount,
				});
			}
		}
	}
	casts.sort((a, b) => a.castTime - b.castTime);
	const available = new Set(casts);
	const matched: InsatiableHungerRawCollect[] = [];

	for (const expected of expectedCollects) {
		const phase = report.phases.find(
			(candidate) => candidate.name === expected.phase,
		);
		if (!phase) continue;
		const assigned: InsatiableHungerRawCast[] = [];

		if (isPhaseCollect(expected)) {
			for (const secondsIntoPhase of expected.times) {
				const expectedTime = phase.start + secondsIntoPhase * 1_000;
				const best = [...available]
					.filter(
						(cast) =>
							cast.castTime >= phase.start &&
							cast.castTime <= phase.end &&
							Math.abs(cast.castTime - expectedTime) <=
								EXPECTED_COLLECT_MATCH_TOLERANCE_MS,
					)
					.sort(
						(a, b) =>
							Math.abs(a.castTime - expectedTime) -
							Math.abs(b.castTime - expectedTime),
					)[0];
				if (!best) continue;
				assigned.push(best);
				available.delete(best);
			}
		} else {
			for (const cast of [...available]) {
				if (cast.castTime < phase.start || cast.castTime > phase.end) continue;
				assigned.push(cast);
				available.delete(cast);
			}
		}

		if (assigned.length === 0) continue;
		assigned.sort((a, b) => a.castTime - b.castTime);
		matched.push({
			name: expected.name,
			phase: expected.phase,
			casts: assigned,
			searchWindow: [
				(assigned[0]?.castTime ?? 0) - COLLECT_SEARCH_PADDING_MS,
				(assigned.at(-1)?.endTime ?? 0) + COLLECT_SEARCH_PADDING_MS,
			],
			expectedOrbCount: assigned.reduce(
				(total, cast) => total + cast.expectedOrbCount,
				0,
			),
		});
	}

	return {
		rawCollects: matched.sort((a, b) => a.searchWindow[0] - b.searchWindow[0]),
		casts,
	};
};
