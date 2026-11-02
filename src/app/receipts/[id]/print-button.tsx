"use client";

import { Printer } from "lucide-react";
import { Button, type BtnProps } from "@/components/ui";

export function PrintButton({ size }: Pick<BtnProps, "size">) {
  return (
    <Button size={size} onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Print or save PDF
    </Button>
  );
}
