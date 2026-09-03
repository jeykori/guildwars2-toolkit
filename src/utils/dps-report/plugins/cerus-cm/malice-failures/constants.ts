import {
	FLOWER_MARKERS,
	FLOWER_PORTAL_IDS,
} from "../encounter-context/constants";
import type { MaliceTime } from "./types";

const p1MaliceTimings = [
	{
		name: "P1-1",
		time: 25,
		portalId: FLOWER_PORTAL_IDS.p1[1],
	},
	{
		name: "P1-2",
		time: 51,
		portalId: FLOWER_PORTAL_IDS.p1[2],
	},
] as const satisfies MaliceTime[];

const p2MaliceTimings = [
	{
		name: "P2-1",
		time: 46,
		portalId: FLOWER_PORTAL_IDS.p2[2],
	},
	{
		name: "P2-2-rage",
		time: 60,
		portalId: FLOWER_PORTAL_IDS.p2[3],
	},
	{
		name: "P2-3",
		time: 111,
		portalId: FLOWER_PORTAL_IDS.p2[4],
	},
] as const satisfies MaliceTime[];

const p3MaliceTimings = [
	{
		name: "P3-1-rage",
		time: 45,
		portalId: FLOWER_PORTAL_IDS.p3[2],
	},
	{
		name: "P3-2-flower-circle",
		time: 62,
		dropLocation: { location: FLOWER_MARKERS.circle, radius: 450 },
	},
	{
		name: "P3-3-fast-port",
		time: 129,
		portalId: FLOWER_PORTAL_IDS.p3[7],
	},
	{
		name: "P3-4-extra-malice",
		time: 135,
		failOnTarget: true,
	},
	{
		name: "P3-4-spiral",
		time: 196,
		portalId: FLOWER_PORTAL_IDS.p3[9],
	},
] as const satisfies MaliceTime[];

const sub10MaliceTimings = [
	{
		name: "P4-1",
		time: 37,
		portalId: FLOWER_PORTAL_IDS.p4[2],
	},
] as const satisfies MaliceTime[];

export const MALICE_TIMINGS = {
	p1: p1MaliceTimings,
	p2: p2MaliceTimings,
	p3: p3MaliceTimings,
	sub10: sub10MaliceTimings,
};
