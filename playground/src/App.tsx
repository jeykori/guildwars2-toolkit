import { BrowserRouter, Route, Routes } from "react-router";
import { DpsReportPage } from "./pages/DpsReportPage";
import NotFoundPage from "./pages/NotFoundPage";
import ReportSummaryPage from "./pages/ReportSummaryPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/parse-dps-report" element={<DpsReportPage />} />
				<Route
					path="/dps-report-summary/:reportId"
					element={<ReportSummaryPage />}
				/>

				{/* Fallback 404 route */}
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</BrowserRouter>
	);
}
