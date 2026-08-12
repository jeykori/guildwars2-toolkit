export type AggregatedPlayer = {
	account: string;
	name: string;
	groups: number[];
	totals: {
		downs: number;
		resses: number;
		resDuration: number;
		mechanics: Record<number, number>;
	};
	averages: {
		targetDps: number;
		cleaveDps: number;
		quickness: number;
		alacrity: number;
		damageTaken: number;
		mechanics: Record<number, number>;
	};
};
