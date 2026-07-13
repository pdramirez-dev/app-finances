"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  label: string;
};

export function PasswordField({ id, label, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={isVisible ? "text" : "password"} className="h-11 pr-11" {...props} />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-inset"
          aria-label={isVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
