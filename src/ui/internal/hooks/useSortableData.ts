import { useMemo, useState } from "react";

const getNestedValue = (obj: unknown, path: string): unknown => {
	return path.split(".").reduce((acc, part) => {
		if (acc !== null && typeof acc === "object" && part in acc) {
			return (acc as Record<string, unknown>)[part];
		}
		return undefined;
	}, obj);
};

const parseSortValue = (val: unknown, type: "auto" | "date" = "auto") => {
	if (val === null || val === undefined) return -Infinity;
	if (typeof val === "number") return val;
	if (val instanceof Date) return val.getTime();

	if (typeof val === "string") {
		if (type === "date") {
			const parsedDate = Date.parse(val);
			return !Number.isNaN(parsedDate) ? parsedDate : -Infinity;
		}

		const stripped = val.replace(/[^0-9.-]+/g, "");
		const num = parseFloat(stripped);

		return !Number.isNaN(num) ? num : val.toLowerCase();
	}

	return val;
};

type InitialOptions = {
	key: string;
	direction?: "asc" | "desc";
	type?: "auto" | "date";
} | null;

export function useSortableData<T>(
	items: T[],
	initialOptions?: InitialOptions,
) {
	const [sortConfig, setSortConfig] = useState<{
		key: string;
		direction: "asc" | "desc";
		type: "auto" | "date";
	} | null>(
		initialOptions
			? {
					key: initialOptions.key,
					direction: initialOptions.direction || "desc",
					type: initialOptions.type || "auto",
				}
			: null,
	);

	const sortedItems = useMemo(() => {
		if (!sortConfig) return items;

		return [...items].sort((a, b) => {
			const aRaw = getNestedValue(a, sortConfig.key);
			const bRaw = getNestedValue(b, sortConfig.key);

			if (Array.isArray(aRaw) && Array.isArray(bRaw)) {
				const minLength = Math.min(aRaw.length, bRaw.length);
				for (let i = 0; i < minLength; i++) {
					if (aRaw[i] !== bRaw[i]) {
						return sortConfig.direction === "asc"
							? (aRaw[i] as number) - (bRaw[i] as number)
							: (bRaw[i] as number) - (aRaw[i] as number);
					}
				}
				return sortConfig.direction === "asc"
					? aRaw.length - bRaw.length
					: bRaw.length - aRaw.length;
			}

			const aValue = parseSortValue(aRaw, sortConfig.type);
			const bValue = parseSortValue(bRaw, sortConfig.type);

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [items, sortConfig]);

	const requestSort = (key: string, type: "auto" | "date" = "auto") => {
		let direction: "asc" | "desc" = "desc";
		if (sortConfig?.key === key && sortConfig?.direction === "desc") {
			direction = "asc";
		}
		setSortConfig({ key, direction, type });
	};

	return { items: sortedItems, requestSort, sortConfig };
}
