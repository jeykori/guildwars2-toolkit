export const FLOWER_MARKERS = {
	center: [375, 375],
	arrow: [342.727, 411.229],
	circle: [579.91, 652.724],
	heart: [407.413, 324.98],
	square: [687.72, 182.671],
	star: [446.225, 553.538],
	spiral: [308.228, 445.728],
	triangle: [390.163, 225.795],
	x: [575.597, 126.61], // closer to square
	x_2: [501.368, 98.815], // more left
} as const satisfies Record<string, readonly [number, number]>;

export const FLOWER_PORTAL_IDS = {
	p1: {
		1: "p1-1_chr_malice",
		2: "p1-2_chr_malice",
		3: "p1-3_scg_rage",
	},
	p2: {
		1: "p2-1_scg_rage",
		2: "p2-2_chr_malice",
		3: "p2-3_chr_malice-rage",
		4: "p2-4_chr_malice",
		5: "p2-5_scg_rage",
	},
	p3: {
		1: "p3-1_scg_rage",
		2: "p3-2_chr_malice-rage",
		3: "p3-3_scg_double-flower-1",
		4: "p3-4_chr_double-flower-2",
		5: "p3-5_scg_bad-collect",
		6: "p3-6_chr_rage",
		7: "p3-7_chr_fast-port",
		8: "p3-8_scg_triangle-flower",
		9: "p3-9_chr_malice",
	},
	p4: {
		1: "p4-1_scg_flower",
		2: "p4-2_chr_flower-malice",
	},
} as const;

export const FLOWER_PORTAL_SKILLS = {
	PORTAL_ENTRE: 10197,
	PORTAL_EXEUNT: 10199,
	SAND_SWELL: 42917,
};

export const CERUS_CM_PHASES = {
	FULL_FIGHT: "Full Fight",
	P1: "Phase 1",
	P2: "Phase 2",
	P3: "Phase 3",
	P50_10: "50%-10%",
	ENRAGED_SMASH: "Enraged Smash",
};
