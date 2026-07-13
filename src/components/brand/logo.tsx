import { cn } from "@/lib/utils";

// A compact mark evoking a tissue microarray: a grid of wells with a few
// highlighted (as if optimally spread across the array).
export function Logo({ className }: { className?: string }) {
  const highlights = new Set(["0-1", "1-3", "2-0", "3-2"]);
  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        className
      )}
    >
      <svg viewBox="0 0 16 16" className="size-5" aria-hidden>
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => {
            const on = highlights.has(`${r}-${c}`);
            return (
              <circle
                key={`${r}-${c}`}
                cx={2.5 + c * 3.7}
                cy={2.5 + r * 3.7}
                r={on ? 1.5 : 1}
                fill="currentColor"
                opacity={on ? 1 : 0.45}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
