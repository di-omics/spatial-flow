"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, Check, Loader2 } from "lucide-react";
import { CoreThumbnail } from "@/components/qc/thumbnail";
import { FailureReasonsChart } from "@/components/charts/charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ASSAY_LABELS, MIF_CHANNELS, INDICATION_COLORS, type Indication } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { approveRun, overrideCore } from "@/app/imaging-qc/actions";

type CoreQC = {
  qcId: string;
  coreId: string;
  coreLabel: string;
  specimenId: string;
  patientCode: string;
  indication: string;
  focusScore: number;
  markerCompleteness: number;
  saturationPct: number;
  tissueLossPct: number;
  segSanity: number;
  verdict: string;
  overrideVerdict: string | null;
  effectiveVerdict: string;
  reviewed: boolean;
  failureReason: string | null;
  note: string | null;
};

type Detail = {
  run: {
    id: string;
    name: string;
    status: string;
    batchId: string;
    assayType: string;
    tmaName: string;
    startDate: string;
    endDate: string | null;
  };
  cores: CoreQC[];
  summary: { PASS: number; FLAG: number; FAIL: number; needsReview: number };
  failureReasons: { reason: string; count: number }[];
};

type RunListItem = {
  id: string;
  name: string;
  status: string;
  assayType: string;
  tmaName: string;
  coreCount: number;
};

const VERDICT_RING: Record<string, string> = {
  PASS: "hsl(152 58% 40%)",
  FLAG: "hsl(38 92% 48%)",
  FAIL: "hsl(350 74% 52%)",
};

export function QcDashboard({
  runs,
  selectedId,
  detail,
}: {
  runs: RunListItem[];
  selectedId: string;
  detail: Detail | null;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<string[]>(MIF_CHANNELS.map((c) => c.key));
  const [onlyReview, setOnlyReview] = useState(false);
  const [activeQc, setActiveQc] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isMif = detail?.run.assayType === "mIF";

  const filtered = useMemo(() => {
    if (!detail) return [];
    return onlyReview
      ? detail.cores.filter((c) => !c.reviewed && c.effectiveVerdict !== "PASS")
      : detail.cores;
  }, [detail, onlyReview]);

  const activeCore = detail?.cores.find((c) => c.qcId === activeQc) ?? null;

  function toggleChannel(key: string) {
    setChannels((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleApprove() {
    if (!detail) return;
    startTransition(async () => {
      await approveRun(detail.run.id);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* Run list */}
      <div className="space-y-2">
        <div className="eyebrow mb-1 px-1">Assay runs</div>
        {runs.map((r) => (
          <Link key={r.id} href={`/imaging-qc?run=${r.id}`} scroll={false}>
            <Card
              className={cn(
                "cursor-pointer p-3 transition-colors hover:border-primary/40",
                r.id === selectedId && "border-primary/60 ring-1 ring-accent"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{r.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{ASSAY_LABELS[r.assayType as keyof typeof ASSAY_LABELS]}</Badge>
                <span>{r.tmaName}</span>
                <span>- {r.coreCount} cores</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Detail */}
      <div className="min-w-0 space-y-4">
        {!detail || detail.cores.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Loader2 className="size-6" />
              </div>
              <div className="text-base font-semibold">Imaging not started</div>
              <p className="max-w-sm text-sm text-muted-foreground">
                This run is planned but no sections have been scanned yet. QC results
                appear here once imaging begins.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header + summary */}
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{detail.run.name}</h2>
                      <StatusBadge status={detail.run.status} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {ASSAY_LABELS[detail.run.assayType as keyof typeof ASSAY_LABELS]} -{" "}
                      {detail.run.tmaName} - {detail.run.batchId} - started{" "}
                      {formatDate(detail.run.startDate)}
                    </div>
                  </div>
                  <Button onClick={handleApprove} disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approve batch
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile icon={<CheckCircle2 className="size-4" />} label="Pass" value={detail.summary.PASS} tone="pass" />
                  <SummaryTile icon={<AlertTriangle className="size-4" />} label="Flag" value={detail.summary.FLAG} tone="flag" />
                  <SummaryTile icon={<XCircle className="size-4" />} label="Fail" value={detail.summary.FAIL} tone="fail" />
                  <SummaryTile label="Needs review" value={detail.summary.needsReview} tone="review" />
                </div>
              </CardContent>
            </Card>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyReview(false)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    !onlyReview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All cores ({detail.cores.length})
                </button>
                <button
                  onClick={() => setOnlyReview(true)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    onlyReview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Needs review ({detail.summary.needsReview})
                </button>
              </div>

              {isMif && (
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-xs text-muted-foreground">Channels</span>
                  {MIF_CHANNELS.map((ch) => {
                    const on = channels.includes(ch.key);
                    return (
                      <button
                        key={ch.key}
                        onClick={() => toggleChannel(ch.key)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-opacity",
                          on ? "opacity-100" : "opacity-40"
                        )}
                        style={{ borderColor: ch.color, color: ch.color }}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Thumbnail grid */}
            <Card>
              <CardContent className="p-4">
                {filtered.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    Nothing in the review queue - all cores are reviewed.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                    {filtered.map((c) => (
                      <button
                        key={c.qcId}
                        onClick={() => setActiveQc(c.qcId)}
                        className="group text-left"
                        title={`${c.specimenId} ${c.coreLabel}`}
                      >
                        <div
                          className="relative aspect-square rounded-md p-[2px] transition-transform group-hover:scale-[1.04]"
                          style={{ background: VERDICT_RING[c.effectiveVerdict] }}
                        >
                          <CoreThumbnail
                            seed={c.coreId}
                            assay={detail.run.assayType}
                            channels={channels}
                            className="size-full"
                          />
                          {!c.reviewed && c.effectiveVerdict !== "PASS" && (
                            <span className="absolute right-1 top-1 size-2 rounded-full bg-white shadow ring-1 ring-black/10" />
                          )}
                        </div>
                        <div className="mt-1 truncate text-[10px] text-muted-foreground">
                          {c.specimenId}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Failure reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Common failure reasons</CardTitle>
                <CardDescription>Across flagged and failed cores in this run.</CardDescription>
              </CardHeader>
              <CardContent>
                <FailureReasonsChart data={detail.failureReasons} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Core detail drawer */}
      <Drawer
        open={!!activeCore}
        onClose={() => setActiveQc(null)}
        title={activeCore ? `${activeCore.specimenId} - ${activeCore.coreLabel}` : ""}
        description={
          activeCore
            ? `${activeCore.patientCode} - ${activeCore.indication}`
            : ""
        }
      >
        {activeCore && detail && (
          <CoreDetail
            core={activeCore}
            assay={detail.run.assayType}
            onSaved={() => {
              setActiveQc(null);
              router.refresh();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  tone: "pass" | "flag" | "fail" | "review";
}) {
  const toneClass = {
    pass: "text-pass",
    flag: "text-[hsl(38_92%_36%)]",
    fail: "text-fail",
    review: "text-review",
  }[tone];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", toneClass)}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}

function CoreDetail({
  core,
  assay,
  onSaved,
}: {
  core: CoreQC;
  assay: string;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(core.note ?? "");
  const [pending, startTransition] = useTransition();

  function save(verdict: "PASS" | "FAIL") {
    startTransition(async () => {
      await overrideCore(core.qcId, verdict, note);
      onSaved();
    });
  }

  const metrics = [
    { label: "Focus score", value: core.focusScore, kind: "unit" as const, good: core.focusScore >= 0.8 },
    { label: "Marker completeness", value: core.markerCompleteness, kind: "unit" as const, good: core.markerCompleteness >= 0.9 },
    { label: "Segmentation sanity", value: core.segSanity, kind: "unit" as const, good: core.segSanity >= 0.8 },
    { label: "Saturation", value: core.saturationPct, kind: "pct" as const, good: core.saturationPct < 5 },
    { label: "Tissue loss", value: core.tissueLossPct, kind: "pct" as const, good: core.tissueLossPct < 10 },
  ];

  return (
    <div className="space-y-5">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-lg p-1"
        style={{ background: VERDICT_RING[core.effectiveVerdict] }}
      >
        <CoreThumbnail seed={core.coreId} assay={assay} className="size-full" />
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={core.effectiveVerdict.toLowerCase() as "pass" | "flag" | "fail"}>
          {core.effectiveVerdict}
        </Badge>
        {core.overrideVerdict && <Badge variant="outline">manual override</Badge>}
        {core.failureReason && (
          <span className="text-sm text-muted-foreground">{core.failureReason}</span>
        )}
      </div>

      <div className="space-y-2.5">
        {metrics.map((m) => (
          <MetricBar key={m.label} {...m} />
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="text-sm font-medium">Manual override</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a review note (optional)..."
          rows={2}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => save("PASS")} disabled={pending}>
            <CheckCircle2 className="size-4 text-pass" />
            Mark pass
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => save("FAIL")} disabled={pending}>
            <XCircle className="size-4 text-fail" />
            Mark fail
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: INDICATION_COLORS[core.indication as Indication] }}
          />
          {core.indication} - core {core.coreId}
        </div>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  kind,
  good,
}: {
  label: string;
  value: number;
  kind: "unit" | "pct";
  good: boolean;
}) {
  const displayPct = kind === "unit" ? value * 100 : value;
  const display = kind === "unit" ? `${Math.round(value * 100)}%` : `${value}%`;
  const barWidth = Math.min(100, displayPct);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular">{display}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${barWidth}%`,
            background: good ? "hsl(152 58% 42%)" : "hsl(38 92% 50%)",
          }}
        />
      </div>
    </div>
  );
}
