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
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [16, 24],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p1["2"],
		description: "Malice after walls",
		phase: "Phase 1",
		openTime: 46,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [42, 50],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p1["3"],
		description: "Out of Rage",
		phase: "Phase 1",
		openTime: 68,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "rage",
				validOpenWindow: [66, 72],
			},
		],
		phasePushForgiveness: 74,
	},
];

const p2: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p2["1"],
		description: "Out of Rage",
		phase: "Phase 2",
		openTime: 14,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 450,
		mechanicRequirements: [
			{
				mechanic: "rage",
				validOpenWindow: [12, 18],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["2"],
		description: "Malice after walls",
		phase: "Phase 2",
		openTime: 39,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [35, 43],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["3"],
		description: "Malice after collects + Out of Rage",
		phase: "Phase 2",
		openTime: 57,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [50, 58.3], // malice at 59
			},
			{
				mechanic: "rage",
				validOpenWindow: [55.5, 65],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["4"],
		description: "Malice after double walls",
		phase: "Phase 2",
		openTime: 106,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [square], radius: 450 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [102, 110],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p2["5"],
		description: "Out of Rage",
		phase: "Phase 2",
		openTime: 128,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 1000, innerRadius: 450 },
		minDistance: 600,
		mechanicRequirements: [
			{
				mechanic: "rage",
				validOpenWindow: [126, 132],
			},
		],
		phasePushForgiveness: 134,
	},
];

const p3: ExpectedPortal[] = [
	{
		id: FLOWER_PORTAL_IDS.p3["1"],
		description: "Out of Rage + wall bait",
		phase: "Phase 3",
		openTime: 10,
		openWindow: 5,
		type: "scourge",
		from: { location: heart, radius: 450 },
		to: { location: [spiral], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "rage",
				validOpenWindow: [8, 14],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["2"],
		description: "Out of Rage + Malice",
		phase: "Phase 3",
		openTime: 43,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [circle], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [36, 44.3], // quite tight
			},
			{
				mechanic: "rage",
				validOpenWindow: [40, 50],
			},
		],
	},
	{
		// boss -> star
		id: FLOWER_PORTAL_IDS.p3["3"],
		description: "Double Flower 1",
		phase: "Phase 3",
		openTime: 55,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				validOpenWindow: [53, 58],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["4"],
		description: "Double Flower 2",
		phase: "Phase 3",
		openTime: 62,
		openWindow: 5,
		type: "chrono",
		from: { location: heart, radius: 450 },
		to: { location: [circle], radius: 600 },
		mechanicRequirements: [
			{
				mechanic: "flower",
				validOpenWindow: [58, 65],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["5"],
		description: "Bad collect",
		phase: "Phase 3",
		openTime: 102,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "bad-collect",
				validOpenWindow: [98, 105], // Quite a large window
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["6"],
		description: "Short port out of Rage",
		phase: "Phase 3",
		openTime: 113,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [x, x_2], radius: 650 },
		mechanicRequirements: [
			{
				mechanic: "rage",
				validOpenWindow: [109, 117],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["7"],
		description: "Fast Port",
		phase: "Phase 3",
		openTime: 123,
		openWindow: 5,
		type: "chrono",
		from: { location: center, radius: 450 },
		to: { location: [x, x_2], radius: 650 },
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [119, 127], // very tight
			},
			{
				mechanic: "flower",
				validOpenWindow: [123, 133],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["8"],
		description: "Triangle flower",
		phase: "Phase 3",
		openTime: 145,
		openWindow: 5,
		type: "scourge",
		from: { location: center, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				validOpenWindow: [143, 148],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p3["9"],
		description: "Malice after ad rage",
		phase: "Phase 3",
		openTime: 191,
		openWindow: 5,
		type: "chrono",
		from: { location: spiral, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [186, 195],
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
		openWindow: 5,
		type: "scourge",
		from: { location: heart, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "flower",
				validOpenWindow: [3, 8],
			},
		],
	},
	{
		id: FLOWER_PORTAL_IDS.p4["2"],
		description: "Sub-10 (Chr)",
		phase: "Enraged Smash",
		openTime: 33,
		openWindow: 5,
		type: "chrono",
		from: { location: heart, radius: 450 },
		minDistance: 650,
		mechanicRequirements: [
			{
				mechanic: "malice",
				validOpenWindow: [30, 34.5], // quite tight
			},
			{
				mechanic: "flower",
				validOpenWindow: [31, 39],
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
