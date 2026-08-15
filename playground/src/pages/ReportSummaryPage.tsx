import { DpsReportSummaryLayout } from "@jeykori/guildwars2-toolkit/ui";
import type { ToolkitComponents } from "@jeykori/guildwars2-toolkit/ui/context/toolkit-context";
import { ToolkitProvider } from "@jeykori/guildwars2-toolkit/ui/context/toolkit-context";
import { useEffect } from "react";
import { useParams } from "react-router";
import useSWR from "swr";
import { getDpsReportSummary } from "@/api";
import * as shadcn from "@/components/shadcn";
import NotFoundPage from "@/pages/NotFoundPage";

const shadcnComponents = shadcn as ToolkitComponents;

export default function ReportSummaryPage() {
	const { reportId } = useParams<{ reportId: string }>();

	const { data, error, isLoading } = useSWR(
		reportId ? ["report-summary", reportId] : null,
		([, id]) => getDpsReportSummary(id),
		{ revalidateOnFocus: false },
	);

	useEffect(() => {
		if (!data) return;
		const fights = data.overview.fights ?? [];
		document.title = `${fights.length === 1 ? fights[0].name : "DPS Report Summary"} | Jeyes`;
	}, [data]);

	if (isLoading)
		return <div className="p-8 text-muted-foreground">Loading summary...</div>;
	if (error || !data) return <NotFoundPage />;

	return (
		<ToolkitProvider components={shadcnComponents}>
			<DpsReportSummaryLayout data={data} />
		</ToolkitProvider>
	);
}
