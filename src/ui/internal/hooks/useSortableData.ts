import { useMemo, useState } from "react";

// Helper to safely traverse nested properties without 'any'
const getNestedValue = (obj: unknown, path: string): unknown => {
	return path.split(".").reduce((acc, part) => {
		if (acc !== null && typeof acc === "object" && part in acc) {
			return (acc as Record<string, unknown>)[part];
		}
		return undefined;
	}, obj);
};

// Helper function to handle formatting and strings
const parseSortValue = (val: unknown) => {
	if (val === null || val === undefined) return -Infinity; // Push empty values to bottom
	if (typeof val === "number") return val;

	if (typeof val === "string") {
		// Strip out spaces, commas, percent signs, and currency symbols
		// Keep digits, decimal points, and negative signs
		const stripped = val.replace(/[^0-9.-]+/g, "");
		const num = parseFloat(stripped);

		// If it successfully parsed to a number, return it.
		// Otherwise, return the lowercased string for clean alphabetical sorting.
		// biome-ignore lint/suspicious/noGlobalIsNan: We are trying to coerce
		return !isNaN(num) ? num : val.toLowerCase();
	}

	return val;
};

export function useSortableData<T>(items: T[], initialKey?: string | null) {
	const [sortConfig, setSortConfig] = useState<{
		key: string;
		direction: "asc" | "desc";
	} | null>(initialKey ? { key: initialKey, direction: "desc" } : null);

	const sortedItems = useMemo(() => {
		// If no sort config, just return the items
		if (!sortConfig) return items;

		return [...items].sort((a, b) => {
			// Use the safe nested getter helper
			const aRaw = getNestedValue(a, sortConfig.key);
			const bRaw = getNestedValue(b, sortConfig.key);

			if (Array.isArray(aRaw) && Array.isArray(bRaw)) {
				// Compare elements sequentially
				const minLength = Math.min(aRaw.length, bRaw.length);
				for (let i = 0; i < minLength; i++) {
					if (aRaw[i] !== bRaw[i]) {
						return sortConfig.direction === "asc"
							? aRaw[i] - bRaw[i]
							: bRaw[i] - aRaw[i];
					}
				}

				// If all compared elements are equal, sort the shorter array first
				return sortConfig.direction === "asc"
					? aRaw.length - bRaw.length
					: bRaw.length - aRaw.length;
			}

			// Parse the values before comparing
			const aValue = parseSortValue(aRaw);
			const bValue = parseSortValue(bRaw);

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [items, sortConfig]);

	const requestSort = (key: string) => {
		let direction: "asc" | "desc" = "desc";
		if (sortConfig?.key === key && sortConfig?.direction === "desc") {
			direction = "asc";
		}
		setSortConfig({ key, direction });
	};

	return { items: sortedItems, requestSort, sortConfig };
}
