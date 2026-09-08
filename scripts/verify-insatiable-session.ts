import type {
	CombatReplayJson,
	DpsReportJson,
} from "../src/types/dps-report/elite-insights";
import { trackInsatiableHungerOrbs } from "../src/utils/dps-report/plugins/cerus-cm/insatiable-hunger";
import type { InsatiableHungerDetails } from "../src/utils/dps-report/plugins/cerus-cm/insatiable-hunger";

const SESSION_LOG_COUNT = 11;

const verifyKnownAttributions = (
	reportId: string,
	details: InsatiableHungerDetails,
) => {
	if (reportId !== "vPO0-20260810-024123_cerus") return;
	const set5 = details.casts[4];
	const empoweredOrb = set5?.orbs[1];
	const finalOrb = set5?.orbs[2];
	if (
		empoweredOrb?.accounting.missedUnits !== 1 ||
		empoweredOrb.events.find((event) => event.type === "empowered")?.time !== 233631 ||
		empoweredOrb.events
			.filter((event) => event.type === "pickup")
			.map(({ player }) => player)
			.join(",") !==
			"Player 4,Player 2" ||
		finalOrb?.accounting.deletedUnits !== 0 ||
		finalOrb.events
			.filter((event) => event.type === "pickup")
			.map(({ player }) => player)
			.join(",") !==
			"Player 3,Player 1,Player 8"
	) {
		throw new Error("vPO0 Set 5 orb attribution regressed");
	}
};

const getCombatReplay = async (reportId: string): Promise<CombatReplayJson> => {
	const response = await fetch(`https://dps.report/${reportId}`);
	if (!response.ok) {
		throw new Error(`Could not load combat replay page for ${reportId}`);
	}
	const html = await response.text();
	const match = html.match(/const _crData = (.*?);\s*const /s);
	if (!match) {
		throw new Error(`Could not extract combat replay data for ${reportId}`);
	}
	return JSON.parse(match[1]) as CombatReplayJson;
};

for (let index = 1; index <= SESSION_LOG_COUNT; index += 1) {
	const sessionLog = (await Bun.file(
		new URL(
			`../playground/public/data/log-data/cerus-session/${index}.json`,
			import.meta.url,
		),
	).json()) as { id: string };
	const reportResponse = await fetch(
		`https://dps.report/getJson?permalink=${sessionLog.id}`,
	);
	if (!reportResponse.ok) {
		throw new Error(`Could not load report JSON for ${sessionLog.id}`);
	}
	const details = trackInsatiableHungerOrbs(
		(await reportResponse.json()) as DpsReportJson,
		await getCombatReplay(sessionLog.id),
	);
	verifyKnownAttributions(sessionLog.id, details);
	const { accounting } = details;
	console.log(
		`${sessionLog.id}: ${accounting.accountedUnits}/${accounting.requiredUnits} observed/inferred units; ${accounting.unresolvedUnits} unresolved`,
	);
	for (const orb of details.casts.flatMap((cast) => cast.orbs)) {
		const eventUnits = orb.events.reduce(
			(total, event) => ({
				collected: total.collected + (event.type === "pickup" ? 1 : 0),
				missed:
					total.missed +
					(event.type === "empowered" ? (event.assignedUnits ?? 0) : 0),
				deleted: total.deleted + (event.type === "delete" ? event.units : 0),
			}),
			{ collected: 0, missed: 0, deleted: 0 },
		);
		if (
			eventUnits.collected !== orb.accounting.collectedUnits ||
			eventUnits.missed !== orb.accounting.missedUnits ||
			eventUnits.deleted !== orb.accounting.deletedUnits
		) {
			throw new Error(`${sessionLog.id} has a ledger/accounting mismatch`);
		}
		if (orb.accounting.accountedUnits > orb.accounting.requiredUnits) {
			throw new Error(`${sessionLog.id} contains an overfilled orb ledger`);
		}
		if (orb.outcome === "unresolved" && !orb.unresolvedReason) {
			throw new Error(`${sessionLog.id} contains an unexplained unresolved orb`);
		}
		if (
			orb.accounting.deletedUnits > 0 &&
			(orb.accounting.missedUnits > 0 ||
				!orb.events.some((event) => event.type === "delete" && event.proof))
		) {
			throw new Error(`${sessionLog.id} contains an unproven deletion`);
		}
	}
	for (const collect of details.collects) {
		const classifiedUnits =
			collect.collectedUnits +
			collect.missedUnits +
			collect.deletedUnits +
			collect.unresolvedUnits;
		if (
			!collect.conserved ||
			classifiedUnits !== collect.expectedOrbCount * 3
		) {
			throw new Error(`${sessionLog.id} has a non-conserving collect ledger`);
		}
	}
}
