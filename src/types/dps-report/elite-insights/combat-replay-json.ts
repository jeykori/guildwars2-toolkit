/** Generated from https://transform.tools/json-to-typescript */
export interface CombatReplayJson {
	decorationRenderings: DecorationRendering[];
	decorationMetadata: DecorationMetadata[];
	actors: Actor[];
	defaultViewpoints: unknown;
	sizes: number[];
	inchToPixel: number;
	pollingRate: number;
}

export interface DecorationRendering {
	fill?: boolean;
	growingEnd?: number;
	growingReverse?: boolean;
	connectedTo: ConnectedTo;
	rotationConnectedTo?: RotationConnectedTo;
	skillMode?: SkillMode;
	metadataSignature: string;
	start: number;
	end: number;
	isMechanicOrSkill: boolean;
	type: number;
	connectedFrom?: ConnectedFrom;
	text?: string;
	interpolationMethod?: number;
	progress?: number[][];
}

export interface ConnectedTo {
	masterID?: number;
	offset?: number[];
	offsetAfterRotation: boolean;
	isScreenSpace: boolean;
	position?: [number, number];
	interpolationMethod?: number;
	positions?: number[];
}

export interface RotationConnectedTo {
	angle?: number;
	masterID?: number;
	rotationOffset?: number;
	rotationOffsetMode?: number;
	spinAngle?: number;
}

export interface SkillMode {
	owner: Owner;
	category: number;
	skillID: number;
	isBuff: boolean;
}

export interface Owner {
	ownerID: number;
}

export interface ConnectedFrom {
	masterID?: number;
	offset: unknown;
	offsetAfterRotation: boolean;
	isScreenSpace: boolean;
	position?: number[];
}

export interface DecorationMetadata {
	image?: string;
	height?: number;
	width?: number;
	signature: string;
	type: number;
	radius?: number;
	minRadius?: number;
	color?: string;
	worldSizeThickness?: boolean;
	thickness?: number;
	opacity?: number;
	pixelSize?: number;
	worldSize?: number;
	pixelWidth?: number;
	pixelHeight?: number;
	secondaryColor?: string;
	innerRadius?: number;
	outerRadius?: number;
}

export interface Actor {
	group?: number;
	start: number;
	end: number;
	dead: number[];
	down: number[];
	dc: number[];
	breakbarActive: number[];
	img: string;
	id: number;
	parentID: number;
	positions: number[];
	angles: number[];
	hide?: number[];
	hitboxWidth: number;
	type: number;
	masterID?: number;
}
