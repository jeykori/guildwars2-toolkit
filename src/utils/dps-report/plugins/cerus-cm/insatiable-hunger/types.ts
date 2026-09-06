export type InsatiableStackCounts = Record<string, number>;

export type InsatiableOrbOutcome =
	| "player-collected"
	| "player-deleted"
	| "cerus-absorbed"
	| "embodiment-absorbed"
	| "phase-despawned"
	| "mechanic-ended"
	| "split-2-bug-despawn"
	| "unresolved";

/** Why the solver refused to turn a missing unit into a deletion or absorb. */
export type InsatiableUnresolvedReason =
	| "partial-ledger-no-terminal-proof"
	| "no-observed-terminal-outcome"
	| "ambiguous-terminal-contact"
	| "causal-contact-only"
	| "actor-stack-partial-ledger"
	| "actor-path-crossing-without-empowered"
	| "late-insatiable-application";

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
	playerInsatiableUnits: number;
	/** Directly observed Empowered stack transitions. */
	actorEmpoweredUnits: number;
	deletedUnits: number;
	phaseDespawnedUnits: number;
	mechanicEndedUnits: number;
	/** Repeated zero-stack Split 2 decoration lifecycle without an actor stack. */
	split2BugDespawnUnits: number;
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
	orbs: InsatiableOrb[];
};

export type InsatiableHungerDetails = {
	casts: InsatiableHungerCast[];
	/** Large-orb decorations that have no nearby Hunger cast in the log. */
	unassignedOrbs: InsatiableOrb[];
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
