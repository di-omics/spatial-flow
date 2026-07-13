// TMA randomization + batch-balance scoring.
//
// Goal: arrange each patient's cores across the array (and, with multiple
// arrays, across slides/batches) so same-patient cores are spread out and
// indications are evenly distributed, minimizing batch/positional effects.
// Control cores are inserted at a fixed cadence.
//
// This runs in TypeScript for the demo so it can execute live in the browser.
// In production this optimizer would be ported to a Python/FastAPI service to
// sit alongside the scientific stack (numpy/scipy), exposed over an API.

import { mulberry32 } from "./utils";

export type PatientCore = {
  coreId: string;
  specimenId: string;
  patientCode: string;
  indication: string;
  label: string;
};

export type Well = {
  row: number;
  col: number;
  coreId: string | null;
  specimenId: string | null;
  patientCode: string | null;
  indication: string | null;
  label: string | null;
  isControl: boolean;
  controlType?: string;
};

export type LayoutConfig = {
  rows: number;
  cols: number;
  controlEveryNWells: number; // insert a control roughly every N wells
  seed: number;
};

export type BalanceScore = {
  overall: number; // 0..100, higher is better
  meanNearestNeighbor: number; // avg distance between nearest same-patient cores (grid units)
  indicationEvenness: number; // 0..1
  controlCoverage: number; // 0..1
  spread: number; // 0..1 normalized same-patient separation
};

export type LayoutResult = {
  wells: Well[];
  score: BalanceScore;
  config: LayoutConfig;
  placedCores: number;
  controlCount: number;
};

const CONTROL_TYPES = ["TONSIL", "LIVER", "SPLEEN", "PLACENTA"];

function gridDistance(a: Well, b: Well): number {
  return Math.hypot(a.row - b.row, a.col - b.col);
}

// Which flat well indices are reserved for controls, given a cadence.
function controlIndices(total: number, everyN: number): Set<number> {
  const set = new Set<number>();
  if (everyN <= 0) return set;
  for (let i = everyN - 1; i < total; i += everyN) set.add(i);
  return set;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build an initial randomized layout: controls at cadence, cores shuffled in.
export function buildLayout(
  cores: PatientCore[],
  config: LayoutConfig
): LayoutResult {
  const { rows, cols, controlEveryNWells, seed } = config;
  const total = rows * cols;
  const rand = mulberry32(seed);
  const controlSet = controlIndices(total, controlEveryNWells);
  const coreWellCount = total - controlSet.size;

  // Only place as many cores as fit; shuffle for randomization.
  const shuffledCores = shuffle(cores, rand).slice(0, coreWellCount);

  const wells: Well[] = [];
  let coreCursor = 0;
  let controlCursor = 0;
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    if (controlSet.has(i)) {
      wells.push({
        row,
        col,
        coreId: null,
        specimenId: null,
        patientCode: null,
        indication: null,
        label: null,
        isControl: true,
        controlType: CONTROL_TYPES[controlCursor++ % CONTROL_TYPES.length],
      });
    } else {
      const core = shuffledCores[coreCursor++];
      wells.push({
        row,
        col,
        coreId: core ? core.coreId : null,
        specimenId: core ? core.specimenId : null,
        patientCode: core ? core.patientCode : null,
        indication: core ? core.indication : null,
        label: core ? core.label : null,
        isControl: false,
      });
    }
  }

  const score = scoreLayout(wells, rows, cols);
  return {
    wells,
    score,
    config,
    placedCores: shuffledCores.length,
    controlCount: controlSet.size,
  };
}

// Score how well the layout spreads same-patient cores and indications.
export function scoreLayout(
  wells: Well[],
  rows: number,
  cols: number
): BalanceScore {
  const occupied = wells.filter((w) => w.coreId && !w.isControl);
  const maxDist = Math.hypot(rows, cols) || 1;

  // 1) Mean nearest-neighbor distance between same-patient cores.
  const byPatient = new Map<string, Well[]>();
  for (const w of occupied) {
    const key = w.specimenId as string;
    if (!byPatient.has(key)) byPatient.set(key, []);
    byPatient.get(key)!.push(w);
  }
  let nnSum = 0;
  let nnCount = 0;
  for (const group of byPatient.values()) {
    if (group.length < 2) continue;
    for (const a of group) {
      let best = Infinity;
      for (const b of group) {
        if (a === b) continue;
        best = Math.min(best, gridDistance(a, b));
      }
      if (best !== Infinity) {
        nnSum += best;
        nnCount++;
      }
    }
  }
  const meanNearestNeighbor = nnCount ? nnSum / nnCount : maxDist;
  const spread = Math.min(1, meanNearestNeighbor / (maxDist * 0.5));

  // 2) Indication evenness across quadrants (entropy-based).
  const midR = rows / 2;
  const midC = cols / 2;
  const quadCounts = new Map<string, number[]>();
  for (const w of occupied) {
    if (!w.indication) continue;
    const q = (w.row < midR ? 0 : 2) + (w.col < midC ? 0 : 1);
    if (!quadCounts.has(w.indication)) quadCounts.set(w.indication, [0, 0, 0, 0]);
    quadCounts.get(w.indication)![q]++;
  }
  let evennessSum = 0;
  let indCount = 0;
  for (const counts of quadCounts.values()) {
    const totalC = counts.reduce((s, c) => s + c, 0);
    if (totalC === 0) continue;
    // Normalized entropy across the 4 quadrants: 1 = perfectly even.
    let entropy = 0;
    for (const c of counts) {
      if (c === 0) continue;
      const p = c / totalC;
      entropy -= p * Math.log(p);
    }
    evennessSum += entropy / Math.log(4);
    indCount++;
  }
  const indicationEvenness = indCount ? evennessSum / indCount : 1;

  // 3) Control coverage: are controls present and reasonably distributed?
  const controls = wells.filter((w) => w.isControl);
  const controlCoverage = controls.length > 0 ? 1 : 0;

  const overall = Math.round(
    (0.55 * spread + 0.35 * indicationEvenness + 0.1 * controlCoverage) * 100
  );

  return {
    overall,
    meanNearestNeighbor,
    indicationEvenness,
    controlCoverage,
    spread,
  };
}

// Hill-climb: try random swaps between two non-control wells; keep improvements.
export function optimizeLayout(
  layout: LayoutResult,
  iterations = 400
): LayoutResult {
  const { rows, cols } = layout.config;
  const wells = layout.wells.map((w) => ({ ...w }));
  const rand = mulberry32(layout.config.seed ^ 0x9e3779b9);
  const swappable = wells
    .map((w, i) => (w.isControl ? -1 : i))
    .filter((i) => i >= 0);

  let current = scoreLayout(wells, rows, cols).overall;

  for (let it = 0; it < iterations; it++) {
    const i = swappable[Math.floor(rand() * swappable.length)];
    const j = swappable[Math.floor(rand() * swappable.length)];
    if (i === j) continue;
    swapCoreContents(wells[i], wells[j]);
    const next = scoreLayout(wells, rows, cols).overall;
    if (next >= current) {
      current = next;
    } else {
      swapCoreContents(wells[i], wells[j]); // revert
    }
  }

  const score = scoreLayout(wells, rows, cols);
  return { ...layout, wells, score };
}

function swapCoreContents(a: Well, b: Well) {
  const keys = ["coreId", "specimenId", "patientCode", "indication", "label"] as const;
  const A = a as Record<string, unknown>;
  const B = b as Record<string, unknown>;
  for (const k of keys) {
    const tmp = A[k];
    A[k] = B[k];
    B[k] = tmp;
  }
}

// Machine-readable export of a layout.
export function layoutToJson(layout: LayoutResult, tmaName: string) {
  return {
    tma: tmaName,
    rows: layout.config.rows,
    cols: layout.config.cols,
    controlEveryNWells: layout.config.controlEveryNWells,
    seed: layout.config.seed,
    batchBalanceScore: layout.score.overall,
    generatedBy: "SpatialFlow TMA Planner",
    wells: layout.wells.map((w) => ({
      row: w.row,
      col: w.col,
      coreId: w.coreId,
      specimenId: w.specimenId,
      indication: w.indication,
      isControl: w.isControl,
      controlType: w.controlType ?? null,
    })),
  };
}

// Physical build list: source specimen/core -> destination row/col.
export function layoutToPicklistCsv(layout: LayoutResult, tmaName: string): string {
  const header = [
    "tma",
    "dest_row",
    "dest_col",
    "well_type",
    "source_specimen",
    "source_core",
    "indication",
    "control_type",
  ].join(",");
  const rows = layout.wells
    .filter((w) => w.coreId || w.isControl)
    .map((w) =>
      [
        tmaName,
        w.row + 1,
        w.col + 1,
        w.isControl ? "CONTROL" : "SAMPLE",
        w.specimenId ?? "",
        w.label ?? "",
        w.indication ?? "",
        w.controlType ?? "",
      ].join(",")
    );
  return [header, ...rows].join("\n");
}
