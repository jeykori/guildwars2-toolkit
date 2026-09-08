/** Each large orb requires three collection units to resolve normally. */
export const ORB_REQUIRED_UNITS = 3;

/** Combat replay metadata used by Elite Insights for Cerus's large orbs. */
export const LARGE_ORB_DECORATION_SIGNATURE = "Cir30rgba(0, 0, 0, 0.5)0";

/**
 * Insatiable Hunger is cast by Cerus/Gluttony during normal phases and by
 * Empowered Embodiment of Gluttony during Split 2. The split cast produces a
 * five-orb batch, while complete normal casts produce three-orb batches. A
 * cast cut off by the encounter ending may have fewer visible decorations.
 */
export const HUNGER_TARGET_IDS = [25989, -53, 25677] as const;

export const HUNGER_SKILL_IDS = {
	/** Normal casts create three large orbs. */
	normal: [71224, 72261],
	/** Empowered casts create five large orbs. */
	empowered: [69538, 72321],
} as const;

export const INSATIABLE_APPLICATION_MECHANIC = "Ins.A";
export const EMPOWERED_APPLICATION_MECHANIC = "Emp.A";
export const RAGE_HIT_MECHANIC = "CryRage.H";

export const EXPECTED_COLLECT_MATCH_TOLERANCE_MS = 3_000;
export const COLLECT_SEARCH_PADDING_MS = 1_000;

/**
 * A second orb touch within this window deletes both orbs. Replay positions
 * are sampled every 300 ms; the Mwij Split 2 deletion spans 958 ms from the
 * confirmed first stack to its decoration's terminal frame.
 */
export const DUPLICATE_TOUCH_WINDOW_MS = 1_000;

/** Allow one replay frame on either side of an event when correlating data. */
export const EVENT_CORRELATION_WINDOW_MS = 350;

/**
 * Actor buff events can trail an orb's terminal effect by several replay
 * frames. This is intentionally wider than ordinary event correlation and is
 * only used after nearer/full/deleted orb candidates have been ruled out.
 */
export const DELAYED_EMPOWERED_EVENT_WINDOW_MS = 1_000;

/**
 * Insatiable Application can arrive up to two 300 ms replay samples after a
 * player overlaps an orb that has already rendered its terminal frame.
 */
export const DELAYED_PICKUP_EVENT_WINDOW_MS = 2 * 300;

/**
 * A mechanic event may be emitted one or two replay frames away from the
 * player position captured by Elite Insights. Use terminal time only when it
 * identifies one physical orb unambiguously.
 */
export const TERMINAL_PICKUP_FALLBACK_WINDOW_MS = 2 * 300;

/**
 * Effect decorations can terminate up to four replay frames before EI's cast
 * duration ends, especially while a failed pull is wiping.
 */
export const MECHANIC_END_DESPAWN_WINDOW_MS = 4 * 300;

/** A player must be this close to the orb path to count as a replay touch. */
export const PLAYER_ORB_CONTACT_RADIUS = 35;

/** A direct event-frame match this close cannot be displaced by late fallback. */
export const DIRECT_PICKUP_LOCK_RADIUS = 15;

/** Deletion inference is stricter than ordinary confirmed pickup attribution. */
export const DELETION_CONTACT_RADIUS = 25;

/** Required distance advantage over the next deletion candidate. */
export const DELETION_ATTRIBUTION_MARGIN = 8;

/** Orb/actor proximity used only to veto a player-deletion conclusion. */
export const ACTOR_ORB_CONTACT_RADIUS = 50;

/** Near-equal replay distances are retained as an explicit attribution issue. */
// A replay sample is 300 ms apart; retain ambiguity only for positions that
// are effectively identical, rather than discarding a clearly nearer orb.
export const ORB_ATTRIBUTION_TIE_DISTANCE = 1;
