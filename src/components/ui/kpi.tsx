import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn("p-4", accent && "ring-1 ring-accent")}>
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight tabular">{value}</div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              delta.direction === "up" && "text-pass",
              delta.direction === "down" && "text-fail",
              delta.direction === "flat" && "text-muted-foreground"
            )}
          >
            {delta.direction === "up" && <ArrowUpRight className="size-3.5" />}
            {delta.direction === "down" && <ArrowDownRight className="size-3.5" />}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
