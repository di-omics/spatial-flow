"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight right-side sheet. No external dependency; closes on overlay
// click or Escape.
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-pop animate-fade-in",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            {title && <div className="text-base font-semibold">{title}</div>}
            {description && (
              <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-5">{children}</div>
      </div>
    </div>
  );
}
