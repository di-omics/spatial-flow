"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Check,
  Loader2,
  Fingerprint,
  Link2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { CoreThumbnail } from "@/components/qc/thumbnail";
import { FailureReasonsChart } from "@/components/charts/charts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ASSAY_LABELS, MIF_CHANNELS, INDICATION_COLORS, type Indication } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { approveRun, overrideCore } from "@/app/imaging-qc/actions";
import { VISION_POLICY } from "@/lib/vision-gate";

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
  foldScore: number;
  verdict: string;
  overrideVerdict: string | null;
  effectiveVerdict: string;
  reviewed: boolean;
  failureReason: string | null;
  note: string | null;
  identity: {
    status: "MATCH" | "MISMATCH" | "LOW_CONFIDENCE" | "MISSING";
    expectedCoreId: string;
    observedCoreId: string | null;
    expectedSlideId: string;
    observedSlideId: string | null;
    confidence: number | null;
  };
  provenance: {
    valid: boolean;
    chainValid: boolean;
    manifestsValid: boolean;
    eventCount: number;
    head: string | null;
    errors: string[];
    acquisitionId: string | null;
    capturedAt: string | null;
  };
  gate: {
    state: "RELEASE" | "RETRY" | "HOLD";
    reasons: string[];
    reasonLabels: string[];
    policyVersion: string;
    recovery: {
      action: string;
      automatic: boolean;
      requiresExpert: boolean;
      attempt: number;
      maxAttempts: number;
      instruction: string;
    };
  };
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
  summary: {
    PASS: number;
    FLAG: number;
    FAIL: number;
    needsReview: number;
    gates: { RELEASE: number; RETRY: number; HOLD: number };
    releaseBlocked: number;
  };
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
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isMif = detail?.run.assayType === "mIF";

  const filtered = useMemo(() => {
    if (!detail) return [];
    return onlyReview
      ? detail.cores.filter(
          (c) => c.gate.state !== "RELEASE" || (!c.reviewed && c.effectiveVerdict !== "PASS")
        )
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
      const result = await approveRun(detail.run.id);
      setReleaseMessage(result.message);
      if (result.ok) router.refresh();
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
                  <Button
                    onClick={handleApprove}
                    disabled={pending || detail.summary.releaseBlocked > 0}
                    title={
                      detail.summary.releaseBlocked > 0
                        ? "Resolve every retry and hold before releasing this run"
                        : "Release under the active vision policy"
                    }
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {detail.summary.releaseBlocked > 0 ? "Release blocked" : "Release run"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryTile icon={<CheckCircle2 className="size-4" />} label="Pass" value={detail.summary.PASS} tone="pass" />
                  <SummaryTile icon={<AlertTriangle className="size-4" />} label="Flag" value={detail.summary.FLAG} tone="flag" />
                  <SummaryTile icon={<XCircle className="size-4" />} label="Fail" value={detail.summary.FAIL} tone="fail" />
                  <SummaryTile label="Needs review" value={detail.summary.needsReview} tone="review" />
                </div>
                {releaseMessage && (
                  <p className="mt-3 text-xs text-muted-foreground">{releaseMessage}</p>
                )}
              </CardContent>
            </Card>

            <GateSummary detail={detail} />

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
                          {c.gate.state !== "RELEASE" && (
                            <span
                              className={cn(
                                "absolute bottom-1 left-1 rounded px-1 py-0.5 text-[8px] font-bold text-white shadow",
                                c.gate.state === "HOLD" ? "bg-fail" : "bg-review"
                              )}
                            >
                              {c.gate.state}
                            </span>
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

function GateSummary({ detail }: { detail: Detail }) {
  const tiles = [
    {
      state: "RELEASE" as const,
      label: "Release-ready",
      value: detail.summary.gates.RELEASE,
      icon: <ShieldCheck className="size-4" />,
      className: "text-pass",
    },
    {
      state: "RETRY" as const,
      label: "Bounded retry",
      value: detail.summary.gates.RETRY,
      icon: <RotateCcw className="size-4" />,
      className: "text-review",
    },
    {
      state: "HOLD" as const,
      label: "Expert hold",
      value: detail.summary.gates.HOLD,
      icon: <AlertTriangle className="size-4" />,
      className: "text-fail",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Autonomous release gate</CardTitle>
            <CardDescription>
              Versioned policy combines sample identity, hash-chained provenance, and vision metrics.
            </CardDescription>
          </div>
          <Badge variant="outline">spatial-qc-v1</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.state} className="rounded-lg border border-border p-3">
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", tile.className)}>
                {tile.icon}
                {tile.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular">{tile.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Identity and provenance failures always fail closed. Only metric exceptions can be
          accepted by a domain expert, and a written rationale is required.
        </p>
      </CardContent>
    </Card>
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(verdict: "PASS" | "FAIL") {
    startTransition(async () => {
      const result = await overrideCore(core.qcId, verdict, note);
      setSaveMessage(result.message);
      if (result.ok) onSaved();
    });
  }

  const metrics = [
    { label: "Focus score", value: core.focusScore, kind: "unit" as const, good: core.focusScore >= VISION_POLICY.thresholds.focusScoreMin },
    { label: "Marker completeness", value: core.markerCompleteness, kind: "unit" as const, good: core.markerCompleteness >= VISION_POLICY.thresholds.markerCompletenessMin },
    { label: "Segmentation sanity", value: core.segSanity, kind: "unit" as const, good: core.segSanity >= VISION_POLICY.thresholds.segSanityMin },
    { label: "Saturation", value: core.saturationPct, kind: "pct" as const, good: core.saturationPct <= VISION_POLICY.thresholds.saturationPctMax },
    { label: "Tissue loss", value: core.tissueLossPct, kind: "pct" as const, good: core.tissueLossPct <= VISION_POLICY.thresholds.tissueLossPctMax },
    { label: "Fold probability", value: core.foldScore, kind: "unit" as const, good: core.foldScore <= VISION_POLICY.thresholds.foldScoreMax },
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

      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="size-4" /> Release policy
          </div>
          <StatusBadge status={core.gate.state} />
        </div>
        {core.gate.reasonLabels.length > 0 && (
          <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
            {core.gate.reasonLabels.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        )}
        <div className="rounded-md bg-muted/50 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-3 font-medium">
            <span>Recovery: {core.gate.recovery.action.replaceAll("_", " ")}</span>
            <span className="text-muted-foreground">
              attempt {core.gate.recovery.attempt}/{core.gate.recovery.maxAttempts}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{core.gate.recovery.instruction}</p>
          <div className="mt-2">
            <Badge variant="outline">
              {core.gate.recovery.requiresExpert
                ? "expert authorization required"
                : core.gate.recovery.automatic
                  ? "bounded automatic action"
                  : "no automatic action"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Fingerprint className="size-4" /> Identity
            </span>
            <StatusBadge status={core.identity.status} />
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Expected: <span className="font-mono text-foreground">{core.identity.expectedCoreId}</span></div>
            <div>Observed: <span className="font-mono text-foreground">{core.identity.observedCoreId ?? "none"}</span></div>
            <div>Confidence: <span className="text-foreground">{core.identity.confidence === null ? "none" : `${(core.identity.confidence * 100).toFixed(1)}%`}</span></div>
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Link2 className="size-4" /> Provenance
            </span>
            <Badge variant={core.provenance.valid ? "pass" : "fail"}>
              {core.provenance.valid ? "Verified" : "Invalid"}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>{core.provenance.eventCount} hash-chained events</div>
            <div className="truncate font-mono" title={core.provenance.head ?? ""}>
              head {core.provenance.head?.slice(0, 12) ?? "none"}
            </div>
            <div className="truncate" title={core.provenance.acquisitionId ?? ""}>
              {core.provenance.acquisitionId ?? "no acquisition id"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {metrics.map((m) => (
          <MetricBar key={m.label} {...m} />
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="text-sm font-medium">Domain-expert disposition</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Scientific rationale (required to accept an exception)..."
          rows={2}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => save("PASS")}
            disabled={pending || note.trim().length < 8}
          >
            <CheckCircle2 className="size-4 text-pass" />
            Accept exception
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => save("FAIL")} disabled={pending}>
            <XCircle className="size-4 text-fail" />
            Keep on hold
          </Button>
        </div>
        {saveMessage && <p className="text-xs text-muted-foreground">{saveMessage}</p>}
        <p className="text-xs text-muted-foreground">
          Expert overrides can accept metric exceptions. They cannot bypass identity or provenance failures.
        </p>
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
