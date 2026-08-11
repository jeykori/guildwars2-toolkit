[![npm version](https://badge.fury.io/js/@jeykori%2Fguildwars2-toolkit.svg)](https://www.npmjs.com/package/@jeykori/guildwars2-toolkit)

# @jeykori/guildwars2-toolkit

Utilities, UI components, and types for Guild Wars 2 development.

## Features

- **DPS Report Utils**:
- `mapDpsReport`: Processes individual raw logs.
- `assembleReports`: Provides an aggregated overview of multiple logs.

- **UI Components**: Headless, style-compatible React components.
- `DpsReportSummaryLayout`: Takes input from the assembler and displays a comprehensive frontend layout.

## Installation

```bash
bun install @jeykori/guildwars2-toolkit

```

---

## Usage

### Backend (Utilities Only)

If you only need the data processing utilities, no further setup is required.

```typescript
import { DpsReport } from "@jeykori/guildwars2-toolkit/utils";

// Example: Map and assemble
const mapped = DpsReport.mapDpsReport(rawJson);
const assembled = DpsReport.assembleReports([mapped]);
```

### Frontend (UI Components)

The UI components rely on your application's Tailwind CSS and shadcn/ui installation.

**1. Configure Tailwind**
Tell your Tailwind compiler to scan the toolkit for utility classes by adding this to your main `index.css` or `globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@jeykori/guildwars2-toolkit/dist/ui";
```

**2. Install Required Components**
Install the necessary components into your project using the shadcn CLI:

```bash
npx shadcn@latest add badge button card checkbox label separator slider table tabs toggle tooltip field

```

**3. Create a Component Export Module**
Create a barrel file (e.g., `src/components/shadcn.ts`) to export all required components as a single object:

```typescript
export * from "./ui/badge";
export * from "./ui/button";
export * from "./ui/card";
export * from "./ui/checkbox";
export * from "./ui/field";
export * from "./ui/label";
export * from "./ui/separator";
export * from "./ui/slider";
export * from "./ui/table";
export * from "./ui/tabs";
export * from "./ui/toggle";
export * from "./ui/tooltip";
```

**4. Wrap Your Application**
Pass the components to the `ToolkitProvider` at the root of your app or feature:

```tsx
import * as shadcn from "@/components/shadcn";
import {
	ToolkitProvider,
	DpsReportSummaryLayout,
} from "@jeykori/guildwars2-toolkit/ui";

export function App({ data }) {
	return (
		<ToolkitProvider components={shadcn}>
			<DpsReportSummaryLayout data={data} />
		</ToolkitProvider>
	);
}
```

---

## Development & Contributing

To develop and test components, this repository includes a Vite playground app.

**Start the Playground:**

```bash
bun run dev

```

### Playground Dev Routes

- **`/parse-dps-report?ids=<comma-separated-ids>`**
  - **Purpose:** Debug and view raw JSON outputs from the data mapper and assembler.
  - **Mock Data:** Use `?ids=cerus`. Sample JSON is already committed in `playground/public/data/dps-report/cerus.json`.

- **`/dps-report-summary/:reportId`**
  - **Purpose:** View the rendered frontend layout of the assembled data.
  - **Mock Data:** Navigate to `/dps-report-summary/cerus-session`. Sample JSON logs are committed in `playground/public/data/log-data/cerus-session`.
