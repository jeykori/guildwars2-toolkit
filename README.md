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

If you only need the data processing utilities, no further setup is required. The UI peer dependencies are completely optional and won't bloat your backend.

```typescript
import { DpsReport } from "@jeykori/guildwars2-toolkit/utils";

// Example: Map and assemble (combatReplayJson is optional)
const mapped = DpsReport.mapDpsReport(dpsReportJson, combatReplayJson);
const assembled = DpsReport.assembleReports([mapped]);
```

### Frontend (UI Components)

**1. Install Peer Dependencies**

The UI components require React, Recharts, and Tailwind CSS.

```bash
bun add react react-dom recharts tailwindcss

```

**2. Configure Tailwind**

Tell your Tailwind compiler to scan the toolkit for utility classes by adding this to your main `index.css` or `globals.css`:

```css
@import "tailwindcss";
@source "../node_modules/@jeykori/guildwars2-toolkit/dist/ui";
```

**3. Use the Components**

You can now import and use the UI components directly in your application:

```tsx
import { DpsReportSummaryLayout } from "@jeykori/guildwars2-toolkit/ui";

export function App({ data }) {
	return <DpsReportSummaryLayout data="{data}" />;
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
