export type InsatiableStackCounts = Record<string, number>;

export type InsatiableCollectPhase =
	| `Phase ${number}`
	| `Split ${number}`;

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
	phase: InsatiableCollectPhase;
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

export type InsatiableOrbCollectionState =
	| "untouched"
	| "once"
	| "twice"
	| "thrice"
	| "more-than-thrice";

export type InsatiableOrbPosition = readonly [number, number];

export type InsatiableOrbPickup = {
	player: string;
	time: number;
	/** Number of Insatiable stacks added by this confirmed application. */
	stackDelta: number;
	/** Player stack value immediately before this application, when available. */
	stackBefore?: number;
	/** Player stack value immediately after this application, when available. */
	stackAfter?: number;
	/** Distance from the player to the orb path at the event time. */
	distance: number | null;
	/** Evidence used to associate this confirmed stack event with this orb. */
	attribution: "position" | "terminal-time";
	confirmed: true;
};

export type InsatiableOrbTouch = {
	player: string;
	time: number;
	distance: number;
	/** This is inferred from replay positions because no second Ins.A exists. */
	confirmed: false;
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
	stackDelta: number;
	/** Portion of stackDelta consumed by this orb's accounting ledger. */
	assignedUnits?: number;
};

export type InsatiableDeletionEvidence = {
	priorInsatiableConfirmed: true;
	noTargetInsatiableApplication: true;
	noActorEmpoweredTransition: true;
	uniqueTerminalContact: true;
	actorPathClear: true;
	priorPickupDeltaMs: number;
	terminalDeltaMs: number;
	contactDistance: number;
};

export type InsatiableOrbAccounting = {
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

export type InsatiableHungerAccounting = InsatiableOrbAccounting & {
	totalOrbs: number;
	resolvedOrbs: number;
	unresolvedOrbs: number;
	unassignedPlayerStackUnits: number;
	unassignedEmpoweredUnits: number;
};

export type InsatiableUnassignedPlayerApplication = {
	player: string;
	time: number;
	stackDelta: number;
	reason: "no-active-orb" | "ambiguous-orb";
};

export type InsatiableOrb = {
	index: number;
	spawnTime: number;
	endTime: number;
	spawnPosition: InsatiableOrbPosition;
	endPosition: InsatiableOrbPosition;
	playerPickups: InsatiableOrbPickup[];
	/** A player-side touch with no matching Ins.A application. */
	inferredTouches: InsatiableOrbTouch[];
	empoweredTransitions: InsatiableEmpoweredTransition[];
	collectionCount: number;
	collectionState: InsatiableOrbCollectionState;
	accounting: InsatiableOrbAccounting;
	outcome: InsatiableOrbOutcome;
	/** Null for resolved outcomes; required with a concrete reason when unresolved. */
	unresolvedReason: InsatiableUnresolvedReason | null;
	deletedBy?: {
		player: string;
		time: number;
		priorPickupTime: number;
		priorOrbIndex: number;
		evidence: "terminal-contact" | "causal-contact";
	};
	/** Complete proof chain required before deletedUnits may be non-zero. */
	deletionEvidence?: InsatiableDeletionEvidence;
	absorbedBy?: string;
	absorptionEvidence?: "empowered-stack";
	phaseDespawnedAt?: number;
	terminalTime: number;
	terminalPosition: InsatiableOrbPosition;
};

export type InsatiableHungerCast = {
	index: number;
	source: string;
	skillId: number;
	castTime: number;
	endTime: number;
	collectName: string;
	phase: InsatiableCollectPhase;
	expectedOrbCount: number;
	orbs: InsatiableOrb[];
};

export type InsatiableCollectPlayerUnits = {
	collectedUnits: number;
	deletedUnits: number;
};

export type InsatiableHungerCollect = {
	name: string;
	phase: InsatiableCollectPhase;
	castStarts: number[];
	searchWindow: [number, number];
	expectedOrbCount: number;
	observedOrbCount: number;
	orbs: InsatiableOrb[];
	players: Record<string, InsatiableCollectPlayerUnits>;
	collectedUnits: number;
	missedUnits: number;
	deletedUnits: number;
	unresolvedUnits: number;
	/** Portion of unresolvedUnits caused by absent LargeOrbs decorations. */
	missingDecorationUnits: number;
	conserved: boolean;
};

export type InsatiableHungerDetails = {
	collects: InsatiableHungerCollect[];
	casts: InsatiableHungerCast[];
	/** Empowered transitions retained even when they do not match an orb. */
	empoweredTransitions: InsatiableEmpoweredTransition[];
	/** Insatiable applications that could not be assigned to one physical orb. */
	unassignedPlayerApplications: InsatiableUnassignedPlayerApplication[];
	/** Conservation ledger across every tracked large-orb decoration. */
	accounting: InsatiableHungerAccounting;
};

export type AggregatedInsatiableHungerDetails = {
	perLog: Record<string, InsatiableHungerDetails>;
};
