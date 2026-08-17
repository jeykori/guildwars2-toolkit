import { DpsReportSummaryLayout } from "@jeykori/guildwars2-toolkit/ui";
import { getDpsReportSummary } from "@playground/api";
import NotFoundPage from "@playground/pages/NotFoundPage";
import { useEffect } from "react";
import { useParams } from "react-router";
import useSWR from "swr";

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

	return <DpsReportSummaryLayout data={data} />;
}
