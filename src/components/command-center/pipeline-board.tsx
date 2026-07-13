import Link from "next/link";
import { STAGE_LABELS, INDICATION_COLORS, type Stage, type Indication } from "@/lib/constants";

type Column = {
  stage: Stage;
  count: number;
  samples: { id: string; indication: string; patientCode: string }[];
};

export function PipelineBoard({ board }: { board: Column[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto scroll-thin pb-2">
      {board.map((col) => (
        <div
          key={col.stage}
          className="flex w-44 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">{STAGE_LABELS[col.stage]}</span>
            <span className="rounded-full bg-card px-1.5 py-0.5 text-[11px] font-medium tabular text-muted-foreground">
              {col.count}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {col.samples.length === 0 && (
              <div className="px-1 py-3 text-center text-[11px] text-muted-foreground">
                Empty
              </div>
            )}
            {col.samples.map((s) => (
              <Link
                key={s.id}
                href={`/command-center/${s.id}`}
                className="rounded-md border border-border bg-card p-2 shadow-sm transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: INDICATION_COLORS[s.indication as Indication],
                    }}
                  />
                  <span className="truncate text-xs font-medium">{s.id}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {s.indication}
                </div>
              </Link>
            ))}
            {col.count > col.samples.length && (
              <div className="px-1 text-[11px] text-muted-foreground">
                +{col.count - col.samples.length} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
