import { FLOWER_MARKERS, FLOWER_PORTAL_IDS } from "./constants";
import type { ExpectedPortal } from "./types";

const { center, circle, heart, square, spiral, x, x_2 } = FLOWER_MARKERS;

/**
 * `openTime`/`openWindow` is just for matching the actual port cast, so we give a larger window.
 * Port and mechanic failures will be handled in each parser.
 *
 * Malice:
 * - drop at time T, max open time T-1, min open time T-9
 * - In other words, malice target time +-4
 *
 * Rage (Scg):
 * - hit at time T, max open time T-1, min open time T-7
 * - In other words, rage start time +4, -2
 *
 * Rage (Chr):
 * - hit at time T, max open time T-1, min open time T-9
 * - In other words, rage start time +-4
 *
 * Flower (Scg):
 * - hit at time T, max open time T-2 (for ICD), min open time T-7
 * - In other words, flower start time +3, -2
 *
 * Flower (Chr):
 * - hit at time T, max open time T-2 (for ICD), min open time T-9
 * - In other words, flower start time +3, -4
 *
 * Note: For multi-mechanics, time window is tighter
 */

const p1: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p1["1"],
		description: "Malice after green",
		phase: "Phase 1",
		openTime: 20,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 19,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p1["2"],
		description: "Malice after walls",
		phase: "Phase 1",
		openTime: 46,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 44,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p1["3"],
		description: "Out of Rage",
		phase: "Phase 1",
		openTime: 68,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "rage",
				expectedCastTime: 66,
			},
		],
		phasePushForgiveness: "Cerus Breakbar 1",
	},
];

const p2: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p2["1"],
		description: "Out of Rage",
		phase: "Phase 2",
		openTime: 14,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 450,
		mechanicRequirements: [
			{
				mechanic: "rage",
				expectedCastTime: 14,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["2"],
		description: "Malice after walls",
		phase: "Phase 2",
		openTime: 39,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 38.4,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["3"],
		description: "Malice after collects + Out of Rage",
		phase: "Phase 2",
		openTime: 57,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 54,
				bufferBeforeHit: 0.7, // allow tigher window
			},
			{
				mechanic: "rage",
				expectedCastTime: 60.3,
				bufferAfterHit: 0.2, // allow tigher window
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["4"],
		description: "Malice after double walls",
		phase: "Phase 2",
		openTime: 106,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 105.6,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["5"],
		description: "Out of Rage",
		phase: "Phase 2",
		openTime: 128,
		type: "scourge",
		from: { location: center, radius: 1000, innerRadius: 450 },
		minDistance: 600,
		mechanicRequirements: [
			{
				mechanic: "rage",
				expectedCastTime: 127.6,
			},
		],
		phasePushForgiveness: "Cerus Breakbar 2",
	},
];

const p3: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p3["1"],
		description: "Out of Rage + wall bait",
		phase: "Phase 3",
		openTime: 10,
		type: "scourge",
		from: { location: heart, radius: 450 },
		to: { location: [spiral], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "rage",
				expectedCastTime: 9,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["2"],
		description: "Out of Rage + Malice",
		phase: "Phase 3",
		openTime: 43,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [circle], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 39,
				bufferBeforeHit: 0.7, // allow tigher window
			},
			{
				mechanic: "rage",
				expectedCastTime: 45.7,
				bufferAfterHit: 0.2, // allow tigher window
			},
		],
	},
	{
		// boss -> star
		id: FLOWER_PORTAL_IDS.p3["3"],
		description: "Double Flower 1",
		phase: "Phase 3",
		openTime: 55,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				expectedCastTime: 54,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["4"],
		description: "Double Flower 2",
		phase: "Phase 3",
		openTime: 62,
		type: "chrono",
		from: { location: heart, radius: 450 },
		to: { location: [circle], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "flower",
				expectedCastTime: 61.6,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["5"],
		description: "Bad collect",
		phase: "Phase 3",
		openTime: 102,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 500,
		mechanicRequirements: [
			{
				mechanic: "bad-collect",
				expectedCastTime: 99,
				bufferBeforeHit: 0.2, // allow tigher window
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["6"],
		description: "Short port out of Rage",
		phase: "Phase 3",
		openTime: 113,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [x, x_2], radius: 650 },
		mechanicRequirements: [
			{
				mechanic: "rage",
				expectedCastTime: 113,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["7"],
		description: "Fast Port",
		phase: "Phase 3",
		openTime: 123,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [x, x_2], radius: 650 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 123,
				bufferBeforeHit: 0.7, // allow tigher window
			},
			{
				mechanic: "flower",
				expectedCastTime: 128.9,
				bufferAfterHit: 0.3, // allow tigher window
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["8"],
		description: "Triangle flower",
		phase: "Phase 3",
		openTime: 145,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				expectedCastTime: 144,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["9"],
		description: "Malice after ad rage",
		phase: "Phase 3",
		openTime: 191,
		type: "chrono",
		from: { location: spiral, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 190.2,
			},
		],
	},
];

// Enraged Smash
const p4: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p4["1"],
		description: "Sub-10 (Scg)",
		phase: "Enraged Smash",
		openTime: 5,
		type: "scourge",
		from: { location: heart, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				expectedCastTime: 5.9,
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p4["2"],
		description: "Sub-10 (Chr)",
		phase: "Enraged Smash",
		openTime: 33,
		type: "chrono",
		from: { location: heart, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "malice",
				expectedCastTime: 30.9,
				bufferBeforeHit: 0.7, // allow tigher window
			},
			{
				mechanic: "flower",
				expectedCastTime: 35.9,
				bufferAfterHit: 0.3, // allow tigher window
			},
		],
	},
];

export const FLOWER_STRAT_PORTALS = ([] as ExpectedPortal[]).concat(
	p1,
	p2,
	p3,
	p4,
);
