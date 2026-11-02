"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button, type BtnProps } from "./ui";

/** A submit button that disables itself and shows a spinner while its form's server action runs. */
export function SubmitButton({ children, disabled, ...p }: ComponentProps<"button"> & BtnProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...p}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
