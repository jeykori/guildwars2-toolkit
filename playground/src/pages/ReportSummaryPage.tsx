import { DpsReportSummaryLayout } from "@jeykori/guildwars2-toolkit/ui";
import { getDpsReportSummary } from "@playground/api";
import NotFoundPage from "@playground/pages/NotFoundPage";
import { useEffect } from "react";
import { useParams } from "react-router";
import useSWR from "swr";

export default function ReportSummaryPage() {
	const { reportIds } = useParams<{ reportIds: string }>();

	const { data, error, isLoading } = useSWR(
		reportIds ? ["report-summary", reportIds] : null,
		([, ids]) => getDpsReportSummary(ids),
		{ revalidateOnFocus: false },
	);

	useEffect(() => {
		if (!data) return;
		const fights = data.overview.fights ?? [];
		document.title = `${fights.length === 1 ? fights[0].name : "DPS Report Summary"} | Jeyes`;
	}, [data]);

	if (isLoading) {
		return <div className="p-8 text-muted-foreground">Loading summary...</div>;
	}

	if (error || !data) return <NotFoundPage />;

	return <DpsReportSummaryLayout data={data} />;
}
