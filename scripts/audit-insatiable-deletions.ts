import type {
	CombatReplayJson,
	DpsReportJson,
} from "../src/types/dps-report/elite-insights";
import {
	DELETION_CONTACT_RADIUS,
	DUPLICATE_TOUCH_WINDOW_MS,
	TERMINAL_PICKUP_FALLBACK_WINDOW_MS,
} from "../src/utils/dps-report/plugins/cerus-cm/insatiable-hunger/constants";
import { trackInsatiableHungerOrbs } from "../src/utils/dps-report/plugins/cerus-cm/insatiable-hunger";

const SESSION_LOG_COUNT = 11;

const getCombatReplay = async (reportId: string): Promise<CombatReplayJson> => {
	const response = await fetch(`https://dps.report/${reportId}`);
	if (!response.ok) throw new Error(`Could not load replay for ${reportId}`);
	const html = await response.text();
	const match = html.match(/const _crData = (.*?);\s*const /s);
	if (!match) throw new Error(`Could not extract replay for ${reportId}`);
	return JSON.parse(match[1]) as CombatReplayJson;
};

let deletionCount = 0;
let unresolvedCount = 0;

for (let index = 1; index <= SESSION_LOG_COUNT; index += 1) {
	const sessionLog = (await Bun.file(
		new URL(
			`../playground/public/data/log-data/cerus-session/${index}.json`,
			import.meta.url,
		),
	).json()) as { id: string };
	const response = await fetch(
		`https://dps.report/getJson?permalink=${sessionLog.id}`,
	);
	if (!response.ok) throw new Error(`Could not load ${sessionLog.id}`);
	const report = (await response.json()) as DpsReportJson;
	const details = trackInsatiableHungerOrbs(
		report,
		await getCombatReplay(sessionLog.id),
	);

	if (details.unassignedPlayerApplications.length > 0) {
		throw new Error(`${sessionLog.id} has unassigned Insatiable applications`);
	}

	for (const cast of details.casts) {
		for (const orb of cast.orbs) {
			if (orb.outcome === "unresolved") {
				unresolvedCount += 1;
				if (!orb.unresolvedReason) {
					throw new Error(
						`${sessionLog.id} Set ${cast.index + 1} orb ${orb.index + 1} is unresolved without a reason`,
					);
				}
			}
			if (orb.accounting.deletedUnits === 0) continue;
			deletionCount += 1;
			const deletion = orb.events.find((event) => event.type === "delete");
			if (!deletion) throw new Error("Deletion has no attributed player");
			const priorDelta = deletion.time - deletion.priorPickupTime;
			const terminalDelta = orb.endTime - deletion.time;
			const errors = [
				deletion.evidence !== "terminal-contact" && "not terminal contact",
				(priorDelta <= 0 || priorDelta > DUPLICATE_TOUCH_WINDOW_MS) &&
					"invalid prior-stack window",
				(terminalDelta < 0 ||
					terminalDelta > TERMINAL_PICKUP_FALLBACK_WINDOW_MS) &&
					"not on terminal frames",
				!deletion.proof && "missing structured proof chain",
				deletion.proof.contactDistance > DELETION_CONTACT_RADIUS && "contact too far",
				!deletion.proof.uniqueTerminalContact && "competing player contact",
				orb.accounting.missedUnits > 0 && "actor stack also assigned",
				orb.events.some(
					(event) => event.type === "pickup" && event.player === deletion.player,
				) &&
					"deleting player also received Insatiable from target orb",
				orb.accounting.accountedUnits !== orb.accounting.requiredUnits &&
					"ledger does not conserve three units",
			].filter(Boolean);
			if (errors.length > 0) {
				throw new Error(
					`${sessionLog.id} Set ${cast.index + 1} orb ${orb.index + 1}: ${errors.join(", ")}`,
				);
			}
			console.log(
				`${sessionLog.id} Set ${cast.index + 1} orb ${orb.index + 1}: ${deletion.player} picked another orb at ${(deletion.priorPickupTime / 1000).toFixed(3)}s, uniquely contacted this orb ${(priorDelta / 1000).toFixed(3)}s later on its terminal frames (${deletion.proof.contactDistance.toFixed(1)} units), received no target-orb Insatiable stack, and no actor Empowered unit was assigned; ${orb.accounting.deletedUnits} unit(s) deleted.`,
			);
		}
	}
}

console.log(
	`Audit complete: ${deletionCount} strict deletions retained; ${unresolvedCount} reasoned unresolved orbs.`,
);
