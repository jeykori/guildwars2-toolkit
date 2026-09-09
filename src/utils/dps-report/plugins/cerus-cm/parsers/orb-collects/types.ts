import type { DecorationRendering } from "../../../../../../types";

export type PickupAssignments = {
	byPlayer: Map<string, PickupWithOrb[]>;
	unassigned: InsatiableUnassignedPlayerApplication[];
};

export type PickupWithOrb = InsatiableOrbPickup & { orbKey: number };

export type InsatiableStackCounts = Record<string, number>;

export type OrbCollectPhase = `Phase ${number}` | `Split ${number}`;

export type ExpectedPhaseCollect = {
	name: string;
	phase: `Phase ${number}`;
	/** Seconds from the beginning of the phase. */
	times: number[];
};

export type ExpectedSplitCollect = {
	name: string;
	phase: `Split ${number}`;
};

export type ExpectedCollect = ExpectedPhaseCollect | ExpectedSplitCollect;

export type InsatiableHungerRawCast = {
	source: string;
	targetId: number;
	skillId: number;
	castTime: number;
	endTime: number;
	expectedOrbCount: 3 | 5;
};

export type InsatiableHungerRawCollect = {
	name: string;
	phase: OrbCollectPhase;
	casts: InsatiableHungerRawCast[];
	/** First cast -1 second through final cast end +1 second. */
	searchWindow: [number, number];
	expectedOrbCount: number;
};

export type InsatiableOrbOutcome =
	| "collected"
	| "missed"
	| "deleted"
	| "unresolved";

/** Why the solver refused to turn a missing unit into a deletion or absorb. */
export type InsatiableUnresolvedReason =
	| "partial-ledger-no-terminal-proof"
	| "no-observed-terminal-outcome"
	| "ambiguous-terminal-contact"
	| "causal-contact-only"
	| "actor-stack-partial-ledger"
	| "actor-path-crossing-without-empowered"
	| "late-insatiable-application"
	| "phase-ended"
	| "mechanic-ended"
	| "split-2-bug-despawn"
	| "missing-decoration";

export type InsatiableOrbPosition = readonly [number, number];

export type InsatiableOrbPickup = {
	player: string;
	time: number;
	/** Distance from the player to the orb path at the event time. */
	distance: number | null;
	/** Evidence used to associate this confirmed stack event with this orb. */
	attribution: "position" | "terminal-time";
};

export type DeletionCandidate = {
	player: string;
	time: number;
	distance: number;
	/** The confirmed Insatiable application that made this deletion eligible. */
	priorPickupTime: number;
	/** Global decoration index of the orb that supplied the prior stack. */
	priorOrbIndex: number;
	/** Whether the no-stack contact coincides with the orb's terminal frames. */
	evidence: "terminal-contact" | "causal-contact";
};

export type InsatiableEmpoweredTransition = {
	target: string;
	source: string;
	time: number;
};

export type OrbDeletionEvidence = {
	priorPickupDeltaMs: number;
	terminalDeltaMs: number;
	contactDistance: number;
};

/** Every observed unit is kept with the event that proved it. */
export type InsatiableOrbEvent =
	| ({ type: "pickup" } & InsatiableOrbPickup)
	| ({
			type: "empowered";
			/** Portion of this transition consumed by this orb's accounting ledger. */
			assignedUnits: number;
	  } & InsatiableEmpoweredTransition)
	| {
			type: "delete";
			player: string;
			time: number;
			priorPickupTime: number;
			priorOrbIndex: number;
			evidence: "terminal-contact" | "causal-contact";
			units: number;
			proof: OrbDeletionEvidence;
	  };

export type SingleOrbAccounting = {
	requiredUnits: number;
	/** Units proven by Ins.A mechanic applications. */
	collectedUnits: number;
	/** Units proven by filtered Emp.A mechanic applications. */
	missedUnits: number;
	deletedUnits: number;
	unresolvedUnits: number;
	accountedUnits: number;
	isBalanced: boolean;
};

export type OrbCollectAccounting = SingleOrbAccounting & {
	totalOrbs: number;
	resolvedOrbs: number;
	unresolvedOrbs: number;
};

export type InsatiableUnassignedPlayerApplication = {
	player: string;
	time: number;
	reason: "no-active-orb" | "ambiguous-orb";
};

/** Public serialized orb shape; parser-only tracking fields live on TrackedInsatiableOrb. */
export type InsatiableOrb = {
	index: number;
	endTime: number;
	endPosition: InsatiableOrbPosition;
	events: InsatiableOrbEvent[];
	accounting: SingleOrbAccounting;
	outcome: InsatiableOrbOutcome;
	/** Null for resolved outcomes; required with a concrete reason when unresolved. */
	unresolvedReason: InsatiableUnresolvedReason | null;
};

export type TrackedInsatiableOrb = InsatiableOrb & {
	decoration: DecorationRendering;
	globalIndex: number;
	collectName: string;
	spawnTime: number;
	spawnPosition: InsatiableOrbPosition;
	collectionCount: number;
	deletionCandidate?: DeletionCandidate;
};

export type InsatiableHungerCast = {
	index: number;
	source: string;
	castTime: number;
	endTime: number;
	collectName: string;
	phase: OrbCollectPhase;
	expectedOrbCount: number;
	orbs: InsatiableOrb[];
};

export type OrbCollectPlayerUnits = {
	collectedUnits: number;
	deletedUnits: number;
};

export type SingleOrbCollect = {
	name: string;
	phase: OrbCollectPhase;
	expectedOrbCount: number;
	players: Record<string, OrbCollectPlayerUnits>; // Frontend uses this for the matrix!
};

export type OrbCollectDetails = {
	collects: SingleOrbCollect[];
	casts: InsatiableHungerCast[];
	/** Conservation ledger across every tracked large-orb decoration. */
	accounting: OrbCollectAccounting;
};

export type AggregatedOrbCollectDetails = {
	perLog: Record<string, OrbCollectDetails>;
};
