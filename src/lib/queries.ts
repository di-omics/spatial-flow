import { prisma } from "@/lib/prisma";
import { STAGES, type Stage } from "@/lib/constants";
import { verifyAcquisitionEvidence } from "@/lib/provenance";
import {
  evaluateVisionGate,
  GATE_REASON_LABELS,
  VISION_POLICY,
  type GateState,
} from "@/lib/vision-gate";

const DAY = 24 * 60 * 60 * 1000;

function effectiveVerdict(q: { verdict: string; overrideVerdict: string | null }) {
  return q.overrideVerdict ?? q.verdict;
}

// ---------------------------------------------------------------------------
// Command Center
// ---------------------------------------------------------------------------
export async function getCommandCenterData() {
  const now = Date.now();
  const [specimens, runs, qc, coreCounts] = await Promise.all([
    prisma.specimen.findMany({ orderBy: { sourceDate: "desc" } }),
    prisma.assayRun.findMany(),
    prisma.qCResult.findMany({ select: { verdict: true, overrideVerdict: true } }),
    prisma.core.groupBy({ by: ["specimenId"], _count: { _all: true } }),
  ]);

  const coreBySpec = new Map(coreCounts.map((c) => [c.specimenId, c._count._all]));

  const thisWeek = specimens.filter(
    (s) => now - new Date(s.sourceDate).getTime() < 7 * DAY
  ).length;

  // 12-week throughput (specimens accessioned per week).
  const throughput: { week: string; count: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const bucketStart = now - (w + 1) * 7 * DAY;
    const bucketEnd = now - w * 7 * DAY;
    const count = specimens.filter((s) => {
      const t = new Date(s.sourceDate).getTime();
      return t >= bucketStart && t < bucketEnd;
    }).length;
    const d = new Date(bucketEnd);
    throughput.push({
      week: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    });
  }

  const activeBatches = new Set(
    runs.filter((r) => r.status === "RUNNING").map((r) => r.batchId)
  ).size;

  const passCount = qc.filter((q) => effectiveVerdict(q) === "PASS").length;
  const qcPassRate = qc.length ? Math.round((passCount / qc.length) * 100) : 0;

  // Stage distribution + a few sample cards per stage for the pipeline board.
  const board = STAGES.map((stage) => {
    const inStage = specimens.filter((s) => s.stage === stage);
    return {
      stage: stage as Stage,
      count: inStage.length,
      samples: inStage.slice(0, 4).map((s) => ({
        id: s.id,
        indication: s.indication,
        patientCode: s.patientCode,
      })),
    };
  });

  // Samples by indication.
  const byIndicationMap = new Map<string, number>();
  for (const s of specimens) {
    byIndicationMap.set(s.indication, (byIndicationMap.get(s.indication) ?? 0) + 1);
  }
  const byIndication = Array.from(byIndicationMap.entries())
    .map(([indication, count]) => ({ indication, count }))
    .sort((a, b) => b.count - a.count);

  const inventory = specimens.map((s) => ({
    id: s.id,
    patientCode: s.patientCode,
    indication: s.indication,
    sourceDate: s.sourceDate.toISOString(),
    ischemiaMinutes: s.ischemiaMinutes,
    necrosisPct: s.necrosisPct,
    qcStatus: s.qcStatus,
    fitForPurpose: s.fitForPurpose,
    stage: s.stage,
    cores: coreBySpec.get(s.id) ?? 0,
  }));

  return {
    kpis: {
      totalSpecimens: specimens.length,
      thisWeek,
      activeBatches,
      qcPassRate,
      throughputTrend: throughput,
      trendDelta: throughputDelta(throughput),
    },
    board,
    byIndication,
    throughput,
    inventory,
  };
}

function throughputDelta(t: { count: number }[]) {
  if (t.length < 4) return 0;
  const recent = t.slice(-3).reduce((s, x) => s + x.count, 0) / 3;
  const prior = t.slice(-6, -3).reduce((s, x) => s + x.count, 0) / 3;
  if (prior === 0) return 100;
  return Math.round(((recent - prior) / prior) * 100);
}

// ---------------------------------------------------------------------------
// Specimen lineage
// ---------------------------------------------------------------------------
export async function getSpecimenLineage(id: string) {
  const specimen = await prisma.specimen.findUnique({
    where: { id },
    include: {
      cores: {
        include: {
          placements: { include: { tma: true } },
          qcResults: { include: { slide: true } },
          images: { include: { slide: true } },
        },
        orderBy: { label: "asc" },
      },
    },
  });
  if (!specimen) return null;

  const placedCores = specimen.cores.filter((c) => c.placements.length > 0);
  const tmaSet = new Map<string, { id: string; name: string; batchId: string }>();
  for (const c of specimen.cores) {
    for (const p of c.placements) {
      tmaSet.set(p.tma.id, { id: p.tma.id, name: p.tma.name, batchId: p.tma.batchId });
    }
  }

  const imageCount = specimen.cores.reduce((s, c) => s + c.images.length, 0);
  const qcResults = specimen.cores.flatMap((c) => c.qcResults);
  const passCount = qcResults.filter((q) => effectiveVerdict(q) === "PASS").length;

  return {
    specimen: {
      id: specimen.id,
      patientCode: specimen.patientCode,
      indication: specimen.indication,
      sourceDate: specimen.sourceDate.toISOString(),
      ischemiaMinutes: specimen.ischemiaMinutes,
      necrosisPct: specimen.necrosisPct,
      qcStatus: specimen.qcStatus,
      fitForPurpose: specimen.fitForPurpose,
      stage: specimen.stage,
    },
    cores: specimen.cores.map((c) => ({
      id: c.id,
      label: c.label,
      diameterMm: c.diameterMm,
      status: c.status,
      placements: c.placements.map((p) => ({
        tmaId: p.tma.id,
        tmaName: p.tma.name,
        row: p.row,
        col: p.col,
      })),
      qc: c.qcResults.map((q) => ({
        slideId: q.slideId,
        verdict: effectiveVerdict(q),
      })),
    })),
    summary: {
      totalCores: specimen.cores.length,
      placedCores: placedCores.length,
      tmas: Array.from(tmaSet.values()),
      imageCount,
      qcTotal: qcResults.length,
      qcPass: passCount,
    },
  };
}

// ---------------------------------------------------------------------------
// TMA Planner
// ---------------------------------------------------------------------------
export async function getPlannerData() {
  const specimens = await prisma.specimen.findMany({
    where: { fitForPurpose: true },
    orderBy: { id: "asc" },
  });
  // Split fit-for-purpose specimens into two cohorts for the batch selector.
  const pool = specimens.map((s, i) => ({
    id: s.id,
    patientCode: s.patientCode,
    indication: s.indication,
    cohort: i % 2 === 0 ? "B-2026-Q2-01" : "B-2026-Q2-02",
  }));
  return { pool };
}

// ---------------------------------------------------------------------------
// Imaging QC
// ---------------------------------------------------------------------------
export async function getRunList() {
  const runs = await prisma.assayRun.findMany({
    include: { slides: { include: { tma: true, _count: { select: { qcResults: true } } } } },
    orderBy: { startDate: "desc" },
  });
  return runs.map((r) => {
    const slide = r.slides[0];
    const qcCount = r.slides.reduce((s, sl) => s + sl._count.qcResults, 0);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      batchId: r.batchId,
      assayType: slide?.assayType ?? "mIF",
      tmaName: slide?.tma.name ?? "",
      startDate: r.startDate.toISOString(),
      endDate: r.endDate ? r.endDate.toISOString() : null,
      coreCount: qcCount,
    };
  });
}

export async function getRunDetail(runId: string) {
  const run = await prisma.assayRun.findUnique({
    where: { id: runId },
    include: {
      slides: {
        include: {
          tma: true,
          images: { orderBy: [{ coreId: "asc" }, { channel: "asc" }] },
          provenanceEvents: { orderBy: { sequence: "asc" } },
          qcResults: {
            include: { core: { include: { specimen: true } } },
            orderBy: { coreId: "asc" },
          },
        },
      },
    },
  });
  if (!run) return null;

  const slide = run.slides[0];
  const qc = run.slides.flatMap((s) => s.qcResults);
  const images = run.slides.flatMap((s) => s.images);
  const events = run.slides.flatMap((s) => s.provenanceEvents);

  const cores = qc.map((q) => {
    const coreId = q.coreId ?? "";
    const acquisitionImages = images.filter(
      (image) => image.coreId === coreId && image.slideId === q.slideId
    );
    const acquisitionEvents = events.filter(
      (event) => event.coreId === coreId && event.slideId === q.slideId
    );
    const evidence = verifyAcquisitionEvidence({
      events: acquisitionEvents,
      images: acquisitionImages,
      expected: {
        specimenId: q.core?.specimenId ?? "",
        coreId,
        slideId: q.slideId,
        assayRunId: run.id,
        acquisitionId: q.acquisitionId,
        observedCoreId: q.observedCoreId,
        observedSlideId: q.observedSlideId,
        identityConfidence: q.identityConfidence,
        metrics: {
          focusScore: q.focusScore,
          markerCompleteness: q.markerCompleteness,
          saturationPct: q.saturationPct,
          tissueLossPct: q.tissueLossPct,
          segSanity: q.segSanity,
          foldScore: q.foldScore,
        },
        verdict: q.verdict,
        policyVersion: q.policyVersion,
      },
    });
    const identityStatus: "MISSING" | "MISMATCH" | "LOW_CONFIDENCE" | "MATCH" =
      !q.observedCoreId || !q.observedSlideId || q.identityConfidence === null
        ? "MISSING"
        : q.observedCoreId !== coreId || q.observedSlideId !== q.slideId
          ? "MISMATCH"
          : q.identityConfidence < VISION_POLICY.thresholds.identityConfidenceMin
            ? "LOW_CONFIDENCE"
            : "MATCH";
    const gate = evaluateVisionGate({
      policyVersion: q.policyVersion,
      expectedCoreId: coreId,
      expectedSlideId: q.slideId,
      observedCoreId: q.observedCoreId,
      observedSlideId: q.observedSlideId,
      identityConfidence: q.identityConfidence,
      provenanceValid: evidence.valid,
      attempt: q.attempt,
      metrics: {
        focusScore: q.focusScore,
        markerCompleteness: q.markerCompleteness,
        saturationPct: q.saturationPct,
        tissueLossPct: q.tissueLossPct,
        segSanity: q.segSanity,
        foldScore: q.foldScore,
      },
      expertOverride:
        q.overrideVerdict === "PASS" || q.overrideVerdict === "FAIL"
          ? q.overrideVerdict
          : null,
      expertNote: q.note,
    });

    return {
      qcId: q.id,
      coreId,
      coreLabel: q.core?.label ?? "",
      specimenId: q.core?.specimenId ?? "",
      patientCode: q.core?.specimen.patientCode ?? "",
      indication: q.core?.specimen.indication ?? "",
      focusScore: q.focusScore,
      markerCompleteness: q.markerCompleteness,
      saturationPct: q.saturationPct,
      tissueLossPct: q.tissueLossPct,
      segSanity: q.segSanity,
      foldScore: q.foldScore,
      verdict: q.verdict,
      overrideVerdict: q.overrideVerdict,
      effectiveVerdict: effectiveVerdict(q),
      reviewed: q.reviewed,
      failureReason: q.failureReason,
      note: q.note,
      identity: {
        status: identityStatus,
        expectedCoreId: coreId,
        observedCoreId: q.observedCoreId,
        expectedSlideId: q.slideId,
        observedSlideId: q.observedSlideId,
        confidence: q.identityConfidence,
      },
      provenance: {
        valid: evidence.valid,
        chainValid: evidence.chainValid,
        manifestsValid: evidence.manifestsValid,
        eventCount: evidence.eventCount,
        head: evidence.head,
        errors: evidence.errors,
        acquisitionId: q.acquisitionId,
        capturedAt: acquisitionImages[0]?.capturedAt?.toISOString() ?? null,
      },
      gate: {
        ...gate,
        reasonLabels: gate.reasons.map((reason) => GATE_REASON_LABELS[reason]),
      },
    };
  });

  const summary = {
    PASS: 0,
    FLAG: 0,
    FAIL: 0,
    needsReview: 0,
    gates: { RELEASE: 0, RETRY: 0, HOLD: 0 } as Record<GateState, number>,
    releaseBlocked: 0,
  };
  const reasons = new Map<string, number>();
  for (const c of cores) {
    summary[c.effectiveVerdict as "PASS" | "FLAG" | "FAIL"]++;
    if (c.gate.state !== "RELEASE" || (!c.reviewed && c.effectiveVerdict !== "PASS")) {
      summary.needsReview++;
    }
    if (c.failureReason && c.effectiveVerdict !== "PASS") {
      reasons.set(c.failureReason, (reasons.get(c.failureReason) ?? 0) + 1);
    }
    summary.gates[c.gate.state]++;
    if (c.gate.state !== "RELEASE") summary.releaseBlocked++;
  }

  return {
    run: {
      id: run.id,
      name: run.name,
      status: run.status,
      batchId: run.batchId,
      assayType: slide?.assayType ?? "mIF",
      tmaName: slide?.tma.name ?? "",
      startDate: run.startDate.toISOString(),
      endDate: run.endDate ? run.endDate.toISOString() : null,
    },
    cores,
    summary,
    failureReasons: Array.from(reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
