// Single source of truth for the product name. Rename the demo here.
export const APP_NAME = "SpatialFlow";
export const APP_TAGLINE = "Automated operations for high-throughput spatial biology";

// Pipeline stages, in order. A specimen sits in exactly one stage at a time.
export const STAGES = [
  "ACCESSIONED",
  "CORED",
  "ON_TMA",
  "STAINED",
  "IMAGED",
  "QCD",
  "INGESTED",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  ACCESSIONED: "Accessioned",
  CORED: "Cored",
  ON_TMA: "On TMA",
  STAINED: "Stained",
  IMAGED: "Imaged",
  QCD: "QC'd",
  INGESTED: "Ingested",
};

// Tumor indications used across synthetic data.
export const INDICATIONS = [
  "NSCLC",
  "Colorectal",
  "Ovarian",
  "Sarcoma",
  "Pancreatic",
  "Breast",
  "Melanoma",
  "Gastric",
] as const;
export type Indication = (typeof INDICATIONS)[number];

// Stable, distinct color per indication (used in charts and the TMA grid).
export const INDICATION_COLORS: Record<Indication, string> = {
  NSCLC: "#0d9488",
  Colorectal: "#6366f1",
  Ovarian: "#db2777",
  Sarcoma: "#f59e0b",
  Pancreatic: "#0ea5e9",
  Breast: "#ec4899",
  Melanoma: "#8b5cf6",
  Gastric: "#14b8a6",
};

export const ASSAY_TYPES = ["mIF", "H_AND_E", "SPATIAL_TX"] as const;
export type AssayType = (typeof ASSAY_TYPES)[number];

export const ASSAY_LABELS: Record<AssayType, string> = {
  mIF: "Multiplex IF",
  H_AND_E: "H&E",
  SPATIAL_TX: "Spatial Tx",
};

// Pseudo-marker channels for the multiplex IF assay (synthetic).
export const MIF_CHANNELS = [
  { key: "DAPI", label: "DAPI", color: "#3b82f6" },
  { key: "CD8", label: "CD8", color: "#10b981" },
  { key: "PANCK", label: "PanCK", color: "#f59e0b" },
  { key: "PD-L1", label: "PD-L1", color: "#ef4444" },
] as const;

export const CONTROL_TYPES = ["TONSIL", "LIVER", "SPLEEN", "PLACENTA"] as const;

export const VERDICTS = ["PASS", "FLAG", "FAIL"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const QC_FAILURE_REASONS = [
  "Out of focus",
  "Marker dropout",
  "Saturation",
  "Tissue loss",
  "Segmentation error",
  "Folded tissue",
] as const;
