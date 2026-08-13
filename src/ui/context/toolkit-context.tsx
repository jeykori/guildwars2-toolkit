import type { ComponentProps, ElementType, ReactNode } from "react";
import { createContext, useContext } from "react";

type CardProps = Omit<ComponentProps<"div">, "ref">;
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
interface ToggleProps extends Pick<ComponentProps<"button">, "title"> {
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
	delayDuration?: number;
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

interface ButtonVariantsParams {
	variant: "default" | "link";
	size: "default" | "xs";
	className: string;
}

export interface ToolkitComponents {
	Card: ElementType<CardProps>;
	CardContent: ElementType<CardContentProps>;
	CardHeader: ElementType<CardHeaderProps>;
	CardTitle: ElementType<CardTitleProps>;
	CardDescription: ElementType<CardDescriptionProps>;
	Field: ElementType<FieldProps>;
	FieldLabel: ElementType<FieldLabelProps>;
	Slider: ElementType<SliderProps>;
	Checkbox: ElementType<CheckboxProps>;
	Toggle: ElementType<ToggleProps>;
	Badge: ElementType<BadgeProps>;
	Table: ElementType<Omit<ComponentProps<"table">, "ref">>;
	TableHead: ElementType<Omit<ComponentProps<"th">, "ref">>;
	TableBody: ElementType<Omit<ComponentProps<"tbody">, "ref">>;
	TableCell: ElementType<Omit<ComponentProps<"td">, "ref">>;
	TableFooter: ElementType<Omit<ComponentProps<"tfoot">, "ref">>;
	TableHeader: ElementType<Omit<ComponentProps<"thead">, "ref">>;
	TableRow: ElementType<Omit<ComponentProps<"tr">, "ref">>;
	TooltipProvider: ElementType<TooltipProviderProps>;
	Tooltip: ElementType<TooltipProps>;
	TooltipTrigger: ElementType<TooltipTriggerProps>;
	TooltipContent: ElementType<TooltipContentProps>;
	Tabs: ElementType<TabsProps>;
	TabsList: ElementType<TabsListProps>;
	TabsTrigger: ElementType<TabsTriggerProps>;
	TabsContent: ElementType<TabsContentProps>;
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

	// We use a Proxy to catch missing components at runtime.
	// If a consumer ignores TypeScript warnings and forgets to pass a component,
	// this throws an exact error pointing to the missing key.
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
