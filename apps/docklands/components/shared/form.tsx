"use client";

import { Label } from "@cloudflare/kumo/components/label";
import * as React from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
} from "react-hook-form";
import { cn } from "@/shared/utils";

const Form = FormProvider;

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
	{} as FormFieldContextValue,
);

const FormField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	...props
}: ControllerProps<TFieldValues, TName>) => (
	<FormFieldContext.Provider value={{ name: props.name }}>
		<Controller {...props} />
	</FormFieldContext.Provider>
);

const useFormField = () => {
	const fieldContext = React.useContext(FormFieldContext);
	const itemContext = React.useContext(FormItemContext);
	const { getFieldState, formState } = useFormContext();

	const fieldState = getFieldState(fieldContext.name, formState);

	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>");
	}

	const { id } = itemContext;

	return {
		id,
		name: fieldContext.name,
		formLabelId: `${id}-form-item-label`,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		...fieldState,
	};
};

type FormItemContextValue = {
	id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
	{} as FormItemContextValue,
);

const FormItem = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	const id = React.useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			<div ref={ref} className={cn("grid gap-2", className)} {...props} />
		</FormItemContext.Provider>
	);
});
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
	HTMLLabelElement,
	React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, _ref) => {
	const { formItemId, formLabelId } = useFormField();

	return (
		<span id={formLabelId} className="contents">
			<Label className={cn(className)} htmlFor={formItemId} {...props} />
		</span>
	);
});
FormLabel.displayName = "FormLabel";

const formControlComponentNames = new Set([
	"Autocomplete",
	"Checkbox",
	"Combobox",
	"FocusShortcutInput",
	"Input",
	"InputArea",
	"InputOTP",
	"NumberInputWithSteps",
	"RadioGroup",
	"Select",
	"Switch",
	"Textarea",
	"ToggleVisibilityInput",
]);

const formControlDomElements = new Set([
	"button",
	"input",
	"select",
	"textarea",
]);
const formLayoutDomElements = new Set(["div", "span"]);

const getElementName = (type: unknown) => {
	if (typeof type === "string") return type;
	return (
		(type as { displayName?: string; name?: string }).displayName ||
		(type as { name?: string }).name ||
		""
	);
};

const FormControl = React.forwardRef<
	HTMLElement,
	React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }
>(({ children, className, ...props }, ref) => {
	const { error, formItemId, formLabelId, formDescriptionId, formMessageId } =
		useFormField();
	const controlProps = {
		id: formItemId,
		"aria-labelledby": formLabelId,
		"aria-describedby": !error
			? `${formDescriptionId}`
			: `${formDescriptionId} ${formMessageId}`,
		"aria-invalid": !!error,
		...props,
	};

	if (React.isValidElement(children)) {
		let controlRefAssigned = false;
		let controlPropsAssigned = false;

		const injectControlProps = (child: React.ReactNode): React.ReactNode => {
			if (!React.isValidElement(child)) return child;

			const element = child as React.ReactElement<any>;
			const childProps = element.props as {
				children?: React.ReactNode;
				className?: string;
				onCheckedChange?: unknown;
			};
			const elementType = element.type;
			const elementName = getElementName(elementType);
			const isDomElement = typeof elementType === "string";
			const isFormControlElement = isDomElement
				? formControlDomElements.has(elementType)
				: formControlComponentNames.has(elementName);

			if (isFormControlElement) {
				const isCompactControl =
					typeof childProps.onCheckedChange === "function";
				const nextRef = !controlRefAssigned ? ref : undefined;
				controlRefAssigned = true;
				controlPropsAssigned = true;

				return React.cloneElement(element, {
					...controlProps,
					className: cn(
						!isCompactControl && "w-full",
						childProps.className,
						className,
					),
					ref: nextRef,
				});
			}

			const canInspectChildren =
				elementType === React.Fragment ||
				(isDomElement && formLayoutDomElements.has(elementType));

			if (canInspectChildren && childProps.children) {
				return React.cloneElement(element, {
					children: React.Children.map(childProps.children, injectControlProps),
				});
			}

			return child;
		};

		const labelledChildren = injectControlProps(children);

		if (controlPropsAssigned) {
			return labelledChildren;
		}

		const childProps = children.props as {
			className?: string;
			onCheckedChange?: unknown;
		};
		const isCompactControl = typeof childProps.onCheckedChange === "function";

		return React.cloneElement(children as React.ReactElement<any>, {
			...controlProps,
			className: cn(
				!isCompactControl && "w-full",
				childProps.className,
				className,
			),
			ref,
		});
	}

	return <span ref={ref as React.Ref<HTMLSpanElement>} {...controlProps} />;
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
	const { formDescriptionId } = useFormField();

	return (
		<p
			ref={ref}
			id={formDescriptionId}
			className={cn("text-sm text-kumo-subtle", className)}
			{...props}
		/>
	);
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error?.message) : children;
	if (!body) return null;

	return (
		<p
			ref={ref}
			id={formMessageId}
			className={cn("text-sm font-medium text-kumo-danger", className)}
			{...props}
		>
			{body}
		</p>
	);
});
FormMessage.displayName = "FormMessage";

export {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
};
