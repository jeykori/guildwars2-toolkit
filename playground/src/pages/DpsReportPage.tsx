import { DpsReport } from "@jeykori/guildwars2-toolkit/utils";
import { getCombatReplayJson, getDpsReportJson } from "@playground/api";
import { Badge } from "@playground/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@playground/components/ui/card";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import useSWR from "swr";

export function DpsReportPage() {
	const [searchParams] = useSearchParams();
	// Expects URL like: /parse-dps-report?ids=id1,id2,id3
	const idsParam = searchParams.get("ids") || "";
	const reportIds = useMemo(
		() => idsParam.split(",").filter(Boolean),
		[idsParam],
	);

	// Fetch all reports in parallel using SWR
	const {
		data: rawJsons,
		error,
		isLoading,
	} = useSWR(
		reportIds.length > 0 ? ["dps-reports-multi", reportIds] : null,
		async ([, ids]) =>
			Promise.all(
				ids.map(async (id) => {
					return {
						dpsReportJson: await getDpsReportJson(id),
						combartReplayJson: await getCombatReplayJson(id),
					};
				}),
			),
	);

	const { mappedReports, assembledReport } = useMemo(() => {
		if (!rawJsons || rawJsons.length === 0) {
			return { mappedReports: [], assembledReport: null };
		}

		// 1. Array of mapDpsReport outputs
		const mapped = rawJsons.map((raw, index) => ({
			id: reportIds[index],
			...DpsReport.mapDpsReport(raw.dpsReportJson, raw.combartReplayJson),
		}));

		// 2. Assembled report output
		const assembled = DpsReport.assembleReports(mapped);

		return { mappedReports: mapped, assembledReport: assembled };
	}, [rawJsons, reportIds]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-100">
				<p className="text-muted-foreground animate-pulse">
					Processing multiple DPS reports...
				</p>
			</div>
		);
	}

	if (error) {
		return (
			<Card className="border-destructive bg-destructive/10">
				<CardHeader>
					<CardTitle className="text-destructive">
						Error Loading Reports
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p>{error.message || "Failed to fetch and transform reports."}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6 max-w-7xl mx-auto p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight">
					DPS Report Parser Pipeline
				</h1>
				<Badge variant="secondary">{reportIds.length} Report(s) Loaded</Badge>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* 1. Array of mapDpsReport outputs */}
				<Card className="shadow-sm">
					<CardHeader>
						<CardTitle>1. Mapped Reports (mapDpsReport)</CardTitle>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-150">
							{JSON.stringify(mappedReports, null, 2)}
						</pre>
					</CardContent>
				</Card>

				{/* 2. Assembled report output */}
				<Card className="shadow-sm">
					<CardHeader>
						<CardTitle>2. Assembled Report Summary Output</CardTitle>
					</CardHeader>
					<CardContent>
						<pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-150">
							{JSON.stringify(assembledReport, null, 2)}
						</pre>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
