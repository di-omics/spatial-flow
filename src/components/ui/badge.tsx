import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        primary: "border-transparent bg-accent text-accent-foreground",
        pass: "border-transparent bg-pass/12 text-pass",
        flag: "border-transparent bg-flag/15 text-[hsl(38_92%_36%)]",
        fail: "border-transparent bg-fail/12 text-fail",
        review: "border-transparent bg-review/12 text-review",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Maps a QC verdict / specimen status string to the right badge variant + label.
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    PASS: { variant: "pass", label: "Pass" },
    FLAG: { variant: "flag", label: "Flag" },
    FAIL: { variant: "fail", label: "Fail" },
    REVIEW: { variant: "review", label: "Review" },
    RUNNING: { variant: "review", label: "Running" },
    DONE: { variant: "pass", label: "Done" },
    PLANNED: { variant: "outline", label: "Planned" },
    SCANNED: { variant: "pass", label: "Scanned" },
    SCANNING: { variant: "review", label: "Scanning" },
    PENDING: { variant: "outline", label: "Pending" },
  };
  const cfg = map[status] ?? { variant: "default" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export { badgeVariants };
