import type {
	ComponentProps,
	ComponentType,
	ReactElement,
	ReactNode,
} from "react";
import { createContext, useContext } from "react";

type CardProps = Omit<ComponentProps<"div">, "ref"> & {
	size?: "default" | "sm";
};
type CardContentProps = Omit<ComponentProps<"div">, "ref">;
type CardHeaderProps = Omit<ComponentProps<"div">, "ref">;
type CardTitleProps = Omit<ComponentProps<"h3">, "ref">;
type CardDescriptionProps = Omit<ComponentProps<"div">, "ref">;

interface FieldProps extends Omit<ComponentProps<"div">, "ref"> {
	orientation?: "horizontal" | "vertical";
}
type FieldLabelProps = Omit<ComponentProps<"label">, "ref">;
interface SliderProps<
	Value extends number | readonly number[] = number | readonly number[],
> {
	value?: Value;
	min?: number | undefined;
	max?: number | undefined;
	step?: number | undefined;
	onValueChange?: (val: Value extends number ? number : Value) => void;
}
interface CheckboxProps
	extends Pick<ComponentProps<"input">, "id" | "checked"> {
	onCheckedChange?: (checked: boolean) => void;
}
interface ToggleProps extends Omit<ComponentProps<"button">, "ref" | "value"> {
	value?: string;
	pressed?: boolean;
	onPressedChange?: (pressed: boolean) => void;
	variant?: "default" | "outline";
	size?: "default" | "sm";
}
interface BadgeProps extends Omit<ComponentProps<"span">, "ref"> {
	variant?: "default" | "secondary" | "outline";
}

// --- Tooltip ---
interface TooltipProviderProps {
	children: ReactNode;
	delay?: number;
}

interface TooltipProps {
	children: ReactNode;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

interface TooltipTriggerProps extends Omit<ComponentProps<"button">, "ref"> {}

interface TooltipContentProps extends Omit<ComponentProps<"div">, "ref"> {
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	sideOffset?: number;
	alignOffset?: number;
}

// --- Tabs ---
interface TabsProps
	extends Omit<ComponentProps<"div">, "defaultValue" | "ref"> {
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	orientation?: "horizontal" | "vertical";
}
type TabsListProps = Omit<ComponentProps<"div">, "ref">;
interface TabsTriggerProps extends Omit<ComponentProps<"button">, "ref"> {
	value: string; // Strictly required so Tabs know which content to show
}
interface TabsContentProps extends Omit<ComponentProps<"div">, "ref"> {
	value: string; // Strictly required to match the trigger
}

// --- Select ---
interface SelectRootChangeEventDetails {
	reason?: string;
	[key: string]: unknown;
}

interface SelectProps {
	children?: ReactNode;
	value?: string | null;
	defaultValue?: string | null;
	multiple?: false;
	onValueChange?(
		value: string | null,
		eventDetails: SelectRootChangeEventDetails,
	): void;
}
type SelectTriggerProps = Omit<ComponentProps<"button">, "ref">;
type SelectValueProps = Omit<ComponentProps<"span">, "ref"> & {
	placeholder?: ReactNode;
};
type SelectContentProps = Omit<ComponentProps<"div">, "ref">;
type SelectItemProps = Omit<ComponentProps<"div">, "ref"> & {
	value: string;
};

// --- Charts & Recharts ---
type ChartThemeName = "light" | "dark";

export type ChartConfig = Record<
	string,
	{
		label?: ReactNode;
		icon?: ComponentType;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<ChartThemeName, string> }
	)
>;

interface ChartContainerProps extends Omit<ComponentProps<"div">, "ref"> {
	config: ChartConfig;
	children: ReactNode;
	initialDimension?: {
		width: number;
		height: number;
	};
}

type ChartTooltipValue = number | string | readonly (number | string)[];

interface ChartTooltipProps {
	active?: boolean;
	content?: ReactElement | ((props: ChartTooltipContentProps) => ReactNode);
	cursor?: boolean | ReactElement | React.SVGProps<SVGSVGElement>;
	separator?: string;
	wrapperStyle?: React.CSSProperties;
}

type ChartDataValue = string | number | undefined;

export interface ChartTooltipPayload {
	name?: string | number;
	value?: ChartTooltipValue;
	dataKey?: string | number | ((obj: unknown) => unknown);
	color?: string;
	graphicalItemId: string;
	payload?: Record<string, ChartDataValue>;
}

interface ChartTooltipContentProps {
	active?: boolean;
	payload?: readonly ChartTooltipPayload[];
	className?: string;
	indicator?: "line" | "dot" | "dashed";
	hideLabel?: boolean;
	hideIndicator?: boolean;
	label?: string | number;
	formatter?: (
		value: ChartTooltipValue | undefined,
		name: string | number | undefined,
		item: ChartTooltipPayload,
		index: number,
		payload: readonly ChartTooltipPayload[],
	) => ReactNode | [ReactNode, ReactNode];
	labelFormatter?: (
		label: ReactNode,
		payload: readonly ChartTooltipPayload[],
	) => ReactNode;
	labelClassName?: string;
	color?: string;
	nameKey?: string;
	labelKey?: string;
}

// Minimal structural types for Recharts primitives used
interface RechartsResponsiveContainerProps {
	aspect?: number;
	width?: number | `${number}%`;
	height?: number | `${number}%`;
	minWidth?: string | number;
	minHeight?: string | number;
	initialDimension?: {
		width: number;
		height: number;
	};
	maxHeight?: number;
	children: ReactNode;
	debounce?: number;
	id?: string | number;
	className?: string | number;
	style?: React.CSSProperties;
	onResize?: (width: number, height: number) => void;
}

interface RechartsLineChartProps {
	data?: unknown[];
	margin?: { top?: number; right?: number; bottom?: number; left?: number };
	children?: ReactNode;
	style?: React.CSSProperties;
	onClick?: (
		nextState: { activeIndex?: number | string | null; [key: string]: unknown },
		event: React.MouseEvent<SVGGraphicsElement>,
	) => void;
}

interface RechartsCartesianGridProps {
	vertical?:
		| boolean
		| ReactElement<SVGElement>
		| React.SVGProps<SVGLineElement>
		| ((props: { [key: string]: unknown }) => ReactElement<SVGElement>);
	horizontal?:
		| boolean
		| ReactElement<SVGElement>
		| React.SVGProps<SVGLineElement>
		| ((props: { [key: string]: unknown }) => ReactElement<SVGElement>);
	strokeDasharray?: string | number;
	className?: string;
}

interface RechartsXAxisProps {
	dataKey?: string;
	tickLine?: boolean;
	axisLine?: boolean;
	tickMargin?: number;
	fontSize?: number | string;
	allowDecimals?: boolean;
	type?: "number" | "category" | "auto";
	domain?:
		| ReadonlyArray<string>
		| ReadonlyArray<number>
		| readonly [
				(
					| string
					| number
					| ((d: number) => string | number)
					| "auto"
					| "dataMin"
					| "dataMax"
				),
				(
					| string
					| number
					| ((d: number) => string | number)
					| "auto"
					| "dataMin"
					| "dataMax"
				),
		  ]
		| ((
				[dataMin, dataMax]: readonly [number, number],
				allowDataOverflow: boolean,
		  ) => readonly [number, number]);
	orientation?: "top" | "bottom";
}

interface RechartsYAxisProps {
	allowDecimals?: boolean;
	type?: "number" | "category" | "auto";
	domain?:
		| ReadonlyArray<string>
		| ReadonlyArray<number>
		| readonly [
				(
					| string
					| number
					| ((d: number) => string | number)
					| "auto"
					| "dataMin"
					| "dataMax"
				),
				(
					| string
					| number
					| ((d: number) => string | number)
					| "auto"
					| "dataMin"
					| "dataMax"
				),
		  ]
		| ((
				[dataMin, dataMax]: readonly [number, number],
				allowDataOverflow: boolean,
		  ) => readonly [number, number]);
	tickLine?: boolean;
	axisLine?: boolean;
	tickMargin?: number;
	fontSize?: number | string;
	tickFormatter?: (value: ChartDataValue, index: number) => string;
}

interface RechartsLineProps {
	type?: "monotone" | "linear" | "step";
	dataKey: string;
	stroke?: string;
	strokeWidth?: number;
	isAnimationActive?: boolean;
	dot?:
		| boolean
		| { r?: number; fill?: string; stroke?: string; strokeWidth?: number };
	activeDot?:
		| boolean
		| { r?: number; fill?: string; stroke?: string; strokeWidth?: number };
}

interface ButtonVariantsParams {
	variant: "default" | "link";
	size: "default" | "xs";
	className: string;
}

type ToolkitComponent<Props> = {
	bivarianceHack(props: Props): ReactNode;
}["bivarianceHack"];

export interface ToolkitComponents {
	Card: ToolkitComponent<CardProps>;
	CardContent: ToolkitComponent<CardContentProps>;
	CardHeader: ToolkitComponent<CardHeaderProps>;
	CardTitle: ToolkitComponent<CardTitleProps>;
	CardDescription: ToolkitComponent<CardDescriptionProps>;
	Field: ToolkitComponent<FieldProps>;
	FieldLabel: ToolkitComponent<FieldLabelProps>;
	Slider: ToolkitComponent<SliderProps>;
	Checkbox: ToolkitComponent<CheckboxProps>;
	Toggle: ToolkitComponent<ToggleProps>;
	Badge: ToolkitComponent<BadgeProps>;
	Table: ToolkitComponent<Omit<ComponentProps<"table">, "ref">>;
	TableHead: ToolkitComponent<Omit<ComponentProps<"th">, "ref">>;
	TableBody: ToolkitComponent<Omit<ComponentProps<"tbody">, "ref">>;
	TableCell: ToolkitComponent<Omit<ComponentProps<"td">, "ref">>;
	TableFooter: ToolkitComponent<Omit<ComponentProps<"tfoot">, "ref">>;
	TableHeader: ToolkitComponent<Omit<ComponentProps<"thead">, "ref">>;
	TableRow: ToolkitComponent<Omit<ComponentProps<"tr">, "ref">>;
	TooltipProvider: ToolkitComponent<TooltipProviderProps>;
	Tooltip: ToolkitComponent<TooltipProps>;
	TooltipTrigger: ToolkitComponent<TooltipTriggerProps>;
	TooltipContent: ToolkitComponent<TooltipContentProps>;
	Tabs: ToolkitComponent<TabsProps>;
	TabsList: ToolkitComponent<TabsListProps>;
	TabsTrigger: ToolkitComponent<TabsTriggerProps>;
	TabsContent: ToolkitComponent<TabsContentProps>;

	// Select Components
	Select: ToolkitComponent<SelectProps>;
	SelectTrigger: ToolkitComponent<SelectTriggerProps>;
	SelectValue: ToolkitComponent<SelectValueProps>;
	SelectContent: ToolkitComponent<SelectContentProps>;
	SelectItem: ToolkitComponent<SelectItemProps>;

	// Shadcn Chart Components
	ChartContainer: ToolkitComponent<ChartContainerProps>;
	ChartTooltip: ToolkitComponent<ChartTooltipProps>;
	ChartTooltipContent: ToolkitComponent<ChartTooltipContentProps>;

	// Recharts Primitives
	recharts: {
		ResponsiveContainer: ToolkitComponent<RechartsResponsiveContainerProps>;
		LineChart: ToolkitComponent<RechartsLineChartProps>;
		Line: ToolkitComponent<RechartsLineProps>;
		XAxis: ToolkitComponent<RechartsXAxisProps>;
		YAxis: ToolkitComponent<RechartsYAxisProps>;
		CartesianGrid: ToolkitComponent<RechartsCartesianGridProps>;
	};

	buttonVariants: (params: ButtonVariantsParams) => string;
}

const ComponentsContext = createContext<ToolkitComponents | null>(null);

export interface ToolkitProviderProps {
	components: ToolkitComponents;
	children: ReactNode;
}

export function ToolkitProvider({
	components,
	children,
}: ToolkitProviderProps) {
	return (
		<ComponentsContext.Provider value={components}>
			{children}
		</ComponentsContext.Provider>
	);
}

export function useToolkitComponents(): ToolkitComponents {
	const context = useContext(ComponentsContext);

	if (!context) {
		throw new Error(
			"[GuildWars2Toolkit] You must wrap your application in a <ToolkitProvider>.",
		);
	}

	return new Proxy(context, {
		get(target, prop) {
			if (target[prop as keyof ToolkitComponents] === undefined) {
				throw new Error(
					`[GuildWars2Toolkit] Missing component: '${String(prop)}' was not provided to ToolkitProvider.`,
				);
			}
			return target[prop as keyof ToolkitComponents];
		},
	});
}
