export const formatNum = (num: number, decimals = 0) =>
	num.toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
export const formatPct = (num: number, decimals = 2) =>
	`${num.toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	})}%`;
export const formatMs = (ms: number) => {
	const m = Math.floor(ms / 60000);
	const s = Math.floor((ms % 60000) / 1000);
	return `${m}m ${s}s`;
};
