import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/form-state";

/** Accessible wiring for one form control: error text linked via aria-describedby. */
export function fieldA11y(state: FormState, name: string, id: string) {
  const error = state.fieldErrors?.[name];
  return {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

/** What the user last submitted for this field, falling back to the saved value. */
export function submitted(state: FormState, name: string, fallback?: string | null) {
  return state.values?.[name] ?? fallback ?? "";
}

export function FormField({
  state,
  name,
  id,
  label,
  hint,
  className,
  children,
}: {
  state: FormState;
  name: string;
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const error = state.fieldErrors?.[name];
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormFeedback({ state }: { state: FormState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      {state.error ?? state.success}
    </p>
  );
}
