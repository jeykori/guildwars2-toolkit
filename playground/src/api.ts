import type {
	CombatReplayJson,
	DpsReportJson,
	DpsReportSummary,
	LogData,
} from "@jeykori/guildwars2-toolkit/types";
import { DpsReport } from "@jeykori/guildwars2-toolkit/utils";

function extractData<T extends object>(varName: string, htmlText: string) {
	const searchString = `const ${varName} = `;
	const start = htmlText.indexOf(searchString) + searchString.length;
	if (start < searchString.length) return null;

	// Find the end of the line, then step backward to the closing "';"
	const end = htmlText.lastIndexOf(";", htmlText.indexOf("\n", start));

	return JSON.parse(htmlText.slice(start, end)) as T;
}

async function fetchJson<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<T> {
	const response = await fetch(endpoint, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!response.ok) {
		// You can customize this error to handle your specific backend error payloads
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}

export async function getDpsReportSummary(
	reportId: string,
): Promise<DpsReportSummary> {
	if (reportId === "cerus-session") {
		const reportPromises = Array.from({ length: 11 }, async (_, i) => {
			const res = await fetch(`/data/log-data/cerus-session/${i + 1}.json`);
			if (!res.ok) {
				throw new Error(`Failed to fetch report ${i + 1}`);
			}
			return res.json();
		});

		const reports = await Promise.all(reportPromises);

		return DpsReport.assembleReports(reports);
	}

	return DpsReport.assembleReports([await getLogData(reportId)]);
}

export async function getLogData(reportId: string): Promise<LogData> {
	const dpsReportJson = await getDpsReportJson(reportId);
	const combatReplayJson = await getCombatReplayJson(reportId);

	const mapped = DpsReport.mapDpsReport(dpsReportJson, combatReplayJson);

	return { id: reportId, ...mapped };
}

export async function getDpsReportJson(
	reportId: string,
): Promise<DpsReportJson> {
	if (reportId === "cerus") {
		const res = await fetch("/data/dps-report/cerus.json");
		return res.json();
	}

	return fetchJson<DpsReportJson>(
		`https://dps.report/getJson?permalink=${reportId}`,
	);
}

export async function getCombatReplayJson(
	reportId: string,
): Promise<CombatReplayJson> {
	if (reportId === "cerus") {
		const res = await fetch("/data/dps-report/cerus.cr.json");
		return res.json();
	}
	const htmlText = await fetch(`https://dps.report/${reportId}`).then((res) =>
		res.text(),
	);

	const crData = extractData<CombatReplayJson>("_crData", htmlText);

	if (!crData) {
		throw new Error("Failed to extract _crData from HTML");
	}

	return crData;
}
