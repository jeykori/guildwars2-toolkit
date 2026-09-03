export interface MaliceTime {
	name: string;
	/** Expected time of hit */
	time: number;
	/** For non-portal malice */
	dropLocation?: {
		location: readonly [number, number];
		radius: number;
		innerRadius?: number;
	};
	/** portalled malice */
	portalId?: string;
	/** Extra malice */
	failOnTarget?: boolean;
}
