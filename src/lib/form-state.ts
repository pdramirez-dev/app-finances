import type { z } from "@/lib/zod";

/**
 * Result of a form server action. `values` echoes what the user submitted so
 * the form can keep it after React resets uncontrolled fields on submit, and
 * `fieldErrors` holds the first message per field for inline display.
 */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** First issue message per top-level field, plus a summary for the banner. */
export function zodFailure(error: z.ZodError, values?: Record<string, string>): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { error: "Revisa los campos marcados", fieldErrors, values };
}
