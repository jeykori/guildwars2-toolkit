import type {
	DpsReportJson,
	DpsReportSummary,
} from "@jeykori/guildwars2-toolkit/types";
import { DpsReport } from "@jeykori/guildwars2-toolkit/utils";

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

	throw new Error("Invalid ID");
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
