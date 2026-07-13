/**
 * Synthetic data generator for the SpatialFlow demo.
 * Deterministic (seeded RNG) so the demo is reproducible.
 *
 * Nothing here is real patient data - indications, IDs, dates, metrics and
 * images are all procedurally generated.
 */
import { PrismaClient } from "@prisma/client";
import { buildLayout, optimizeLayout, type PatientCore } from "../src/lib/tma";

const prisma = new PrismaClient();

// ---- deterministic RNG -----------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260712);
const rand = () => rng();
const randInt = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const randFloat = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const round = (n: number, d = 1) => Number(n.toFixed(d));

const TODAY = new Date("2026-07-12T12:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * dayMs);

const INDICATIONS = [
  "NSCLC",
  "Colorectal",
  "Ovarian",
  "Sarcoma",
  "Pancreatic",
  "Breast",
  "Melanoma",
  "Gastric",
] as const;
const STAGES = [
  "ACCESSIONED",
  "CORED",
  "ON_TMA",
  "STAINED",
  "IMAGED",
  "QCD",
  "INGESTED",
] as const;
const CONTROL_TYPES = ["TONSIL", "LIVER", "SPLEEN", "PLACENTA"];
const MIF_CHANNELS = ["DAPI", "CD8", "PANCK", "PD-L1"];
const FAILURE_REASONS = [
  "Out of focus",
  "Marker dropout",
  "Saturation",
  "Tissue loss",
  "Segmentation error",
  "Folded tissue",
];

// Weighted stage distribution - a realistic in-flight funnel.
const STAGE_WEIGHTS: Record<string, number> = {
  ACCESSIONED: 6,
  CORED: 7,
  ON_TMA: 9,
  STAINED: 8,
  IMAGED: 10,
  QCD: 12,
  INGESTED: 18,
};
function weightedStage(): string {
  const total = Object.values(STAGE_WEIGHTS).reduce((s, v) => s + v, 0);
  let r = rand() * total;
  for (const s of STAGES) {
    r -= STAGE_WEIGHTS[s];
    if (r <= 0) return s;
  }
  return "INGESTED";
}

type QCMetrics = {
  focusScore: number;
  markerCompleteness: number;
  saturationPct: number;
  tissueLossPct: number;
  segSanity: number;
  verdict: string;
  failureReason: string | null;
};

// ~80/12/8 PASS/FLAG/FAIL, with metrics consistent with the verdict.
function makeQC(): QCMetrics {
  const r = rand();
  if (r < 0.8) {
    return {
      focusScore: round(randFloat(0.85, 0.99), 2),
      markerCompleteness: round(randFloat(0.92, 1.0), 2),
      saturationPct: round(randFloat(0.3, 3), 1),
      tissueLossPct: round(randFloat(0, 5), 1),
      segSanity: round(randFloat(0.85, 0.99), 2),
      verdict: "PASS",
      failureReason: null,
    };
  } else if (r < 0.92) {
    return {
      focusScore: round(randFloat(0.62, 0.85), 2),
      markerCompleteness: round(randFloat(0.76, 0.92), 2),
      saturationPct: round(randFloat(3, 8), 1),
      tissueLossPct: round(randFloat(5, 15), 1),
      segSanity: round(randFloat(0.66, 0.85), 2),
      verdict: "FLAG",
      failureReason: pick(FAILURE_REASONS),
    };
  }
  return {
    focusScore: round(randFloat(0.25, 0.62), 2),
    markerCompleteness: round(randFloat(0.4, 0.76), 2),
    saturationPct: round(randFloat(8, 24), 1),
    tissueLossPct: round(randFloat(15, 45), 1),
    segSanity: round(randFloat(0.3, 0.66), 2),
    verdict: "FAIL",
    failureReason: pick(FAILURE_REASONS),
  };
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.qCResult.deleteMany();
  await prisma.imageFile.deleteMany();
  await prisma.corePlacement.deleteMany();
  await prisma.slide.deleteMany();
  await prisma.assayRun.deleteMany();
  await prisma.tMA.deleteMany();
  await prisma.core.deleteMany();
  await prisma.specimen.deleteMany();

  // ---- Specimens + cores ---------------------------------------------------
  const SPECIMEN_COUNT = 60;
  const specimens: {
    id: string;
    patientCode: string;
    indication: string;
    sourceDate: Date;
    ischemiaMinutes: number;
    necrosisPct: number;
    qcStatus: string;
    fitForPurpose: boolean;
    stage: string;
    createdAt: Date;
  }[] = [];
  const cores: {
    id: string;
    specimenId: string;
    label: string;
    diameterMm: number;
    status: string;
  }[] = [];
  const corePool: PatientCore[] = [];

  for (let i = 1; i <= SPECIMEN_COUNT; i++) {
    const id = `SPC-${String(i).padStart(4, "0")}`;
    const indication = pick(INDICATIONS);
    // Ramp sourceDates toward the present so throughput trends upward.
    const offset = Math.floor((1 - Math.sqrt(rand())) * 83);
    const sourceDate = daysAgo(offset);
    const ischemia = randInt(12, 88);
    const necrosis = round(randFloat(0, 42), 1);
    // fit-for-purpose degrades with long ischemia / high necrosis.
    const marginal = ischemia > 70 || necrosis > 30;
    const bad = ischemia > 82 || necrosis > 38;
    const qcStatus = bad ? "FAIL" : marginal && rand() < 0.5 ? "REVIEW" : "PASS";
    const fitForPurpose = qcStatus === "PASS";
    const stage = qcStatus === "FAIL" ? "ACCESSIONED" : weightedStage();

    specimens.push({
      id,
      patientCode: `PT-${String(randInt(10000, 99999))}`,
      indication,
      sourceDate,
      ischemiaMinutes: ischemia,
      necrosisPct: necrosis,
      qcStatus,
      fitForPurpose,
      stage,
      createdAt: new Date(sourceDate.getTime() + randInt(1, 4) * dayMs),
    });

    const coreCount = randInt(12, 24);
    for (let c = 1; c <= coreCount; c++) {
      const coreId = `${id}-C${String(c).padStart(2, "0")}`;
      const diameter = pick([1.0, 1.5, 2.0]);
      cores.push({
        id: coreId,
        specimenId: id,
        label: `C${String(c).padStart(2, "0")}`,
        diameterMm: diameter,
        status: "CUT",
      });
      corePool.push({
        coreId,
        specimenId: id,
        patientCode: specimens[specimens.length - 1].patientCode,
        indication,
        label: `C${String(c).padStart(2, "0")}`,
      });
    }
  }

  console.log(`Creating ${specimens.length} specimens, ${cores.length} cores...`);
  await prisma.specimen.createMany({ data: specimens });
  for (let i = 0; i < cores.length; i += 500) {
    await prisma.core.createMany({ data: cores.slice(i, i + 500) });
  }

  // ---- TMAs + placements ---------------------------------------------------
  // Round-robin cores across TMAs so each patient's cores spread across arrays.
  const TMA_DEFS = [
    { id: "TMA-A", name: "TMA A", batchId: "B-2026-Q2-01", createdAt: daysAgo(48) },
    { id: "TMA-B", name: "TMA B", batchId: "B-2026-Q2-01", createdAt: daysAgo(41) },
    { id: "TMA-C", name: "TMA C", batchId: "B-2026-Q2-02", createdAt: daysAgo(26) },
    { id: "TMA-D", name: "TMA D", batchId: "B-2026-Q2-02", createdAt: daysAgo(12) },
  ];
  const perTma: PatientCore[][] = TMA_DEFS.map(() => []);
  corePool.forEach((c, idx) => perTma[idx % TMA_DEFS.length].push(c));

  const placedCoreIds = new Set<string>();
  const placements: {
    tmaId: string;
    coreId: string | null;
    row: number;
    col: number;
    isControl: boolean;
    controlType: string | null;
  }[] = [];

  for (let t = 0; t < TMA_DEFS.length; t++) {
    const def = TMA_DEFS[t];
    await prisma.tMA.create({
      data: {
        id: def.id,
        name: def.name,
        rows: 12,
        cols: 12,
        batchId: def.batchId,
        createdAt: def.createdAt,
      },
    });
    // Build then optimize the layout with the shared planner logic.
    let layout = buildLayout(perTma[t], {
      rows: 12,
      cols: 12,
      controlEveryNWells: 12,
      seed: 1000 + t,
    });
    layout = optimizeLayout(layout, 300);
    for (const w of layout.wells) {
      if (w.coreId) placedCoreIds.add(w.coreId);
      placements.push({
        tmaId: def.id,
        coreId: w.coreId,
        row: w.row,
        col: w.col,
        isControl: w.isControl,
        controlType: w.controlType ?? null,
      });
    }
    console.log(`  ${def.id}: batch-balance score ${layout.score.overall}`);
  }
  for (let i = 0; i < placements.length; i += 500) {
    await prisma.corePlacement.createMany({ data: placements.slice(i, i + 500) });
  }
  // Mark placed cores as PLACED.
  await prisma.core.updateMany({
    where: { id: { in: Array.from(placedCoreIds) } },
    data: { status: "PLACED" },
  });

  // ---- Slides --------------------------------------------------------------
  // Each TMA has adjacent sections for mIF / H&E / spatial transcriptomics.
  const ASSAYS = ["mIF", "H_AND_E", "SPATIAL_TX"];
  const slides: {
    id: string;
    tmaId: string;
    assayType: string;
    scanStatus: string;
    assayRunId: string | null;
  }[] = [];
  for (const def of TMA_DEFS) {
    for (const assay of ASSAYS) {
      slides.push({
        id: `${def.id}-${assay}`,
        tmaId: def.id,
        assayType: assay,
        scanStatus: "PENDING",
        assayRunId: null,
      });
    }
  }

  // ---- Assay runs ----------------------------------------------------------
  const RUNS = [
    { id: "AR-mIF-014", name: "mIF Run 014", assay: "mIF", tma: "TMA-A", batchId: "B-2026-Q2-01", status: "DONE", start: 44, end: 40 },
    { id: "AR-HE-009", name: "H&E Run 009", assay: "H_AND_E", tma: "TMA-A", batchId: "B-2026-Q2-01", status: "DONE", start: 43, end: 41 },
    { id: "AR-STX-006", name: "Spatial Tx Run 006", assay: "SPATIAL_TX", tma: "TMA-B", batchId: "B-2026-Q2-01", status: "RUNNING", start: 9, end: null },
    { id: "AR-mIF-015", name: "mIF Run 015", assay: "mIF", tma: "TMA-C", batchId: "B-2026-Q2-02", status: "RUNNING", start: 6, end: null },
    { id: "AR-STX-007", name: "Spatial Tx Run 007", assay: "SPATIAL_TX", tma: "TMA-D", batchId: "B-2026-Q2-02", status: "PLANNED", start: -3, end: null },
  ];

  for (const run of RUNS) {
    await prisma.assayRun.create({
      data: {
        id: run.id,
        name: run.name,
        batchId: run.batchId,
        startDate: daysAgo(run.start),
        endDate: run.end === null ? null : daysAgo(run.end),
        status: run.status,
      },
    });
    // Attach the matching slide to this run and set scan status.
    const slide = slides.find((s) => s.tmaId === run.tma && s.assayType === run.assay);
    if (slide) {
      slide.assayRunId = run.id;
      slide.scanStatus =
        run.status === "DONE" ? "SCANNED" : run.status === "RUNNING" ? "SCANNING" : "PENDING";
    }
  }
  await prisma.slide.createMany({ data: slides });

  // ---- Image files + QC results -------------------------------------------
  // Only runs that have started (DONE/RUNNING) produce imagery + QC.
  const placementsByTma = new Map<string, typeof placements>();
  for (const p of placements) {
    if (!p.coreId) continue;
    if (!placementsByTma.has(p.tmaId)) placementsByTma.set(p.tmaId, []);
    placementsByTma.get(p.tmaId)!.push(p);
  }

  const images: {
    slideId: string;
    coreId: string;
    channel: string;
    uri: string;
    qcMetricsJson: string;
  }[] = [];
  const qcResults: {
    coreId: string;
    slideId: string;
    focusScore: number;
    markerCompleteness: number;
    saturationPct: number;
    tissueLossPct: number;
    segSanity: number;
    verdict: string;
    reviewed: boolean;
    overrideVerdict: string | null;
    note: string | null;
    failureReason: string | null;
    createdAt: Date;
  }[] = [];

  for (const run of RUNS) {
    if (run.status === "PLANNED") continue;
    const slide = slides.find((s) => s.tmaId === run.tma && s.assayType === run.assay)!;
    const tmaPlacements = placementsByTma.get(run.tma) ?? [];
    for (const p of tmaPlacements) {
      const coreId = p.coreId!;
      const qc = makeQC();
      const channels = run.assay === "mIF" ? MIF_CHANNELS : [run.assay];
      for (const ch of channels) {
        images.push({
          slideId: slide.id,
          coreId,
          channel: ch,
          uri: `synthetic://${run.tma.toLowerCase()}/${run.assay.toLowerCase()}/${coreId}/${ch}.ome.tiff`,
          qcMetricsJson: JSON.stringify({
            meanIntensity: round(randFloat(120, 900), 0),
            snr: round(randFloat(4, 40), 1),
          }),
        });
      }
      // DONE runs are fully reviewed; RUNNING runs leave flags/fails to review.
      const reviewed = run.status === "DONE" ? true : qc.verdict === "PASS";
      qcResults.push({
        coreId,
        slideId: slide.id,
        focusScore: qc.focusScore,
        markerCompleteness: qc.markerCompleteness,
        saturationPct: qc.saturationPct,
        tissueLossPct: qc.tissueLossPct,
        segSanity: qc.segSanity,
        verdict: qc.verdict,
        reviewed,
        overrideVerdict: null,
        note: null,
        failureReason: qc.failureReason,
        createdAt: daysAgo(run.end ?? run.start),
      });
    }
    // Mark cores on scanned/scanning slides as imaged.
    await prisma.core.updateMany({
      where: { id: { in: tmaPlacements.map((p) => p.coreId!) } },
      data: { status: "IMAGED" },
    });
  }

  console.log(`Creating ${images.length} image files, ${qcResults.length} QC results...`);
  for (let i = 0; i < images.length; i += 500) {
    await prisma.imageFile.createMany({ data: images.slice(i, i + 500) });
  }
  for (let i = 0; i < qcResults.length; i += 500) {
    await prisma.qCResult.createMany({ data: qcResults.slice(i, i + 500) });
  }

  // ---- summary -------------------------------------------------------------
  const counts = {
    specimens: await prisma.specimen.count(),
    cores: await prisma.core.count(),
    tmas: await prisma.tMA.count(),
    placements: await prisma.corePlacement.count(),
    slides: await prisma.slide.count(),
    runs: await prisma.assayRun.count(),
    images: await prisma.imageFile.count(),
    qc: await prisma.qCResult.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
