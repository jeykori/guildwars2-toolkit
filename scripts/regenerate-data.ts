import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getDpsReportJson } from "../playground/src/api";
import { mapDpsReport } from "../src/utils/dps-report";

// Define your sessions as a map of FolderName -> Array of Report IDs
const SESSIONS: Record<string, string[]> = {
	"cerus-session": [
		"2CeL-20260810-030036_cerus",
		"cu3c-20260810-025556_cerus",
		"CxzD-20260810-023220_cerus",
		"E9oq-20260810-031626_cerus",
		"gSd6-20260810-032248_cerus",
		"GUEN-20260810-024640_cerus",
		"Mwij-20260810-030703_cerus",
		"QwN7-20260810-033600_cerus",
		"R3by-20260810-024502_cerus",
		"V8cm-20260810-032643_cerus",
		"vPO0-20260810-024123_cerus",
	],
};

const BASE_OUT_DIR = path.resolve(
	process.cwd(),
	"playground/public/data/log-data",
);

async function main() {
	// 1. Iterate over the object entries (folderName and its report IDs)
	for (const [folderName, reportIds] of Object.entries(SESSIONS)) {
		const outDir = path.join(BASE_OUT_DIR, folderName);

		console.log(`\n📂 Starting session: ${folderName}`);
		console.log(`🧹 Ensuring output directory exists: ${outDir}`);
		await mkdir(outDir, { recursive: true });

		for (const [index, link] of reportIds.entries()) {
			const fileNum = index + 1;
			const outputPath = path.join(outDir, `${fileNum}.json`);

			try {
				console.log(`  [${fileNum}/${reportIds.length}] Fetching ${link}...`);

				// Fetch raw data
				const rawJson = await getDpsReportJson(link);

				// Map data
				const mappedData = mapDpsReport(rawJson);

				// Save as formatted JSON using Bun's native write
				await Bun.write(
					outputPath,
					JSON.stringify({ id: link, ...mappedData }),
				);

				console.log(`  ✅ Saved ${folderName}/${fileNum}.json`);
			} catch (error) {
				console.error(`  ❌ Failed processing ${link}:`, error);
			}
		}
	}

	console.log("\n🎉 All done!");
}

main();
