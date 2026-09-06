# Insatiable Hunger orb reconstruction

This feature reconstructs the lifecycle of every large Insatiable Hunger orb in
Temple of Febe CM/LCM. It is deliberately evidence-first: an orb unit remains
unresolved when the log does not prove a pickup, actor absorption, deletion, or
terminal despawn.

## Why the model uses three-unit ledgers

Each large orb represents three units. A unit can be resolved by:

- an Insatiable application attributed to a player touching that orb;
- an Empowered stack attributed to Cerus or an embodiment;
- a strictly proven player deletion;
- a mechanic-end, phase-end, or known Split 2 bug despawn; or
- an unresolved reason when none of the above is sufficiently supported.

The conservation invariant is:

```text
required units = player pickups + actor Empowered units + deleted units
               + terminal despawn units + unresolved units
```

No orb may receive more than three units. Pickup and Empowered events are
assigned before deletion inference, so a deletion can never overwrite an
observed stack transition.

## Defensive attribution order

1. Reconstruct moving orb decorations and attach them to the nearest eligible
   Insatiable Hunger cast. Casts may contain three or five orbs.
2. Match positive player Insatiable transitions to nearby orb paths. A close
   direct match is locked before later reconciliation.
3. Match positive Empowered transitions on Cerus and encounter embodiments to
   eligible terminal orb paths.
4. Classify known terminal despawns from mechanic and phase timing.
5. Infer deletion only when one player recently collected another orb, is the
   unique close contact on this orb's terminal frames, receives no Insatiable
   unit from this orb, and no actor Empowered unit is assigned. Actor path
   crossing vetoes deletion even without an observed Empowered transition.
6. Preserve every remaining unit as unresolved with a machine-readable reason.

`deletionEvidence` records the timing, distance, uniqueness margin, terminal
contact, missing target-orb Insatiable application, and absence of an assigned
actor Empowered unit. This makes every retained deletion auditable rather than
merely balancing the ledger.

## UI contract

The encounter overview uses the repository's `TopPlayersMetricWidget` for a
native **Most Hunger Deletions** card. The Cerus details tab uses the existing
cards, tables, badges, and `PlayerNameCell` identity component.

For one selected log it reports:

- orbs reconstructed;
- confirmed player pickups;
- strictly deleted orbs and units;
- Empowered leak units;
- strictly unresolved units and their reasons;
- player involvement; and
- one compact three-unit ledger per orb set.

For multiple selected logs it reports:

- total reviewed orbs and logs;
- aggregate pickups, strict deletions, and Empowered leaks;
- unresolved units, affected-log count, and reason mix;
- player pickup/deletion totals using shared player identity cells; and
- one row per log with a complete or unresolved review status.

Terminal despawns are shown separately from failures: they explain conserved
units but should not be scored against a player. Unresolved units are review
debt, not silently reclassified deletions.

## Validation

Run:

```sh
bun test
bun run verify:insatiable-session
bun run audit:insatiable-deletions
```

The fixture tests cover decoration discovery, delayed player and actor stacks,
direct-attribution locking, actor crossing vetoes, three- and five-orb casts,
and integration with the Cerus plugin. The session verifier enforces unit
conservation and regression cases across the committed session fixtures. The
deletion audit prints the complete rationale for every retained deletion.

## Known limitation

Combat replay is sampled and some buff applications are delayed relative to
contact. The solver therefore cannot truthfully force every unit into a terminal
outcome. New evidence should extend the attribution stages or introduce a
specific unresolved reason; it should not loosen deletion until ambiguous
contacts happen to balance.
