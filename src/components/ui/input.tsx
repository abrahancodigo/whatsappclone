import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef(function Input(
  { className, type, ...props }: InputProps,
  ref: React.Ref<HTMLInputElement>
) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-tx-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-wa-green)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
export type { InputProps };
