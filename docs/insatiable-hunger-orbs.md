# Insatiable Hunger orb reconstruction

This feature reconstructs Insatiable Hunger from the encounter's expected
collect timetable. It deliberately leaves a unit unresolved when the log does
not prove a player collection, an actor miss, or a deletion.

## Expected collect contract

Only casts from Cerus/Gluttony target IDs `25989`, `-53`, and `25677` are
eligible. Skills `71224` and `72261` expect three large orbs; empowered skills
`69538` and `72321` expect five.

Phase casts are matched within ±3 seconds of these phase-relative times:

| Phase | Collect | Seconds into phase |
| --- | --- | --- |
| Phase 1 | `p1-1_cerus` | 51 |
| Phase 2 | `p2-1_double-collect` | 34, 44 |
| Phase 2 | `p2-2_cerus` | 112 |
| Phase 3 | `p3-1_double-collect` | 24, 30 |
| Phase 3 | `p3-2_bad-collect_cerus` | 97 |
| Phase 3 | `p3-3_rage_embodiment` | 114 |
| Phase 3 | `p3-4_cerus` | 164 |
| Phase 3 | `p3-5_green-phase_embodiment` | 204 |

Every eligible cast inside Split 1 or Split 2 belongs to that split's collect.
Unmatched casts are discarded. A collect's raw-data search window runs from one
second before its first cast through one second after its final cast ends.

## Four-outcome conservation

Each expected orb contributes exactly three units:

```text
expected units = collected + missed + deleted + unresolved
```

- **Collected** comes from `Ins.A` mechanic events, including their event
  weights. Player buff-state arrays are not read.
- **Missed** comes from `Emp.A` mechanic events. The five-event Malice
  application cluster is excluded, and the closest `Emp.A` for each
  `CryRage.H` in its -1 to +3 second window is excluded. This deliberately does
  not read target Empowered buff uptime.
- **Deleted** requires a prior confirmed `Ins.A` from another orb within one
  second, unique close contact on this orb's terminal frames, no `Ins.A` from
  the target orb, no assigned `Emp.A`, and a clear actor path.
- **Unresolved** receives every remaining unit with a concrete reason. A
  missing expected LargeOrbs decoration contributes three unresolved units;
  the solver never manufactures a decoration.

No physical orb can receive more than three resolved units. The solver applies
evidence in this fixed order:

1. match expected collects and establish each expected unit budget;
2. assign filtered `Emp.A` misses to the nearest disappearance;
3. assign `Ins.A` collections using replay positions;
4. infer deletion only from the capacity that remains;
5. classify every remainder as unresolved.

An already complete collect skips deletion inference. `deletionEvidence`
records the full timing, distance, uniqueness, no-stack, no-Empowered, and
actor-path proof chain for every retained deletion.

## UI contract

The encounter overview uses the repository's `TOP_PLAYERS` metric format for
**Most Hunger Deletions**. Phase 3 values are also exposed on the equivalent
`50%-10%` phase.

The existing Cerus details card shows topline expected orbs, collections,
strict deletions, misses, and unresolved units. Its compact matrix has one
column per phase/collect plus final totals; rows are players, Missed,
Unresolved, and Totals. Player cells display `units (deleted)` through the
shared `PlayerNameCell`. With one selected log, the matrix is followed by each
orb's auditable three-unit ledger. With multiple logs, it is followed by one
compact review row per log rather than a combined orb dump.

## Validation

Run:

```sh
bun test
bun run verify:insatiable-session
bun run audit:insatiable-deletions
```

Contract tests cover the expected timetable, ID-based cast discovery, the
inclusive ±3-second boundary, double-collect grouping, unmatched-cast
discarding, Malice/Rage exclusions, absent decorations, four-outcome
conservation, delayed mechanics, three- and five-orb casts, and Cerus plugin
integration. The session verifier checks all committed session logs. The
deletion audit rejects any deletion without its complete proof chain and prints
the rationale for every deletion that remains.
