export const VISION_POLICY = {
  version: "spatial-qc-v1",
  thresholds: {
    focusScoreMin: 0.8,
    markerCompletenessMin: 0.9,
    saturationPctMax: 5,
    tissueLossPctMax: 10,
    segSanityMin: 0.8,
    foldScoreMax: 0.25,
    identityConfidenceMin: 0.98,
  },
  maxAttempts: 2,
} as const;

export type GateState = "RELEASE" | "RETRY" | "HOLD";

export type GateReason =
  | "POLICY_VERSION_MISMATCH"
  | "IDENTITY_MISSING"
  | "IDENTITY_MISMATCH"
  | "IDENTITY_CONFIDENCE_LOW"
  | "PROVENANCE_INVALID"
  | "EXPERT_REJECTED"
  | "EXPERT_RATIONALE_REQUIRED"
  | "EXPERT_OVERRIDE_RECORDED"
  | "FOCUS_LOW"
  | "MARKER_DROPOUT"
  | "SATURATION_HIGH"
  | "TISSUE_LOSS_HIGH"
  | "SEGMENTATION_UNSTABLE"
  | "FOLD_DETECTED"
  | "RETRY_BUDGET_EXHAUSTED";

export type RecoveryAction =
  | "NONE"
  | "RESCAN"
  | "REPROCESS"
  | "RESTAIN"
  | "RECUT"
  | "QUARANTINE"
  | "EXPERT_REVIEW";

export type VisionGateInput = {
  policyVersion: string;
  expectedCoreId: string;
  expectedSlideId: string;
  observedCoreId: string | null;
  observedSlideId: string | null;
  identityConfidence: number | null;
  provenanceValid: boolean;
  attempt: number;
  metrics: {
    focusScore: number;
    markerCompleteness: number;
    saturationPct: number;
    tissueLossPct: number;
    segSanity: number;
    foldScore: number;
  };
  expertOverride?: "PASS" | "FAIL" | null;
  expertNote?: string | null;
};

export type VisionGateDecision = {
  state: GateState;
  reasons: GateReason[];
  policyVersion: string;
  recovery: {
    action: RecoveryAction;
    automatic: boolean;
    requiresExpert: boolean;
    attempt: number;
    maxAttempts: number;
    instruction: string;
  };
};

export const GATE_REASON_LABELS: Record<GateReason, string> = {
  POLICY_VERSION_MISMATCH: "QC policy version mismatch",
  IDENTITY_MISSING: "Identity evidence missing",
  IDENTITY_MISMATCH: "Observed label does not match expected sample",
  IDENTITY_CONFIDENCE_LOW: "Identity confidence below release threshold",
  PROVENANCE_INVALID: "Provenance chain or image manifest is invalid",
  EXPERT_REJECTED: "Domain expert rejected this acquisition",
  EXPERT_RATIONALE_REQUIRED: "A pass override requires an expert rationale",
  EXPERT_OVERRIDE_RECORDED: "Domain expert accepted the metric exception",
  FOCUS_LOW: "Focus below policy threshold",
  MARKER_DROPOUT: "Marker completeness below policy threshold",
  SATURATION_HIGH: "Saturation above policy threshold",
  TISSUE_LOSS_HIGH: "Tissue loss above policy threshold",
  SEGMENTATION_UNSTABLE: "Segmentation sanity below policy threshold",
  FOLD_DETECTED: "Fold probability above policy threshold",
  RETRY_BUDGET_EXHAUSTED: "Automatic retry budget exhausted",
};

function recovery(
  state: GateState,
  reasons: GateReason[],
  action: RecoveryAction,
  automatic: boolean,
  requiresExpert: boolean,
  attempt: number,
  instruction: string
): VisionGateDecision {
  return {
    state,
    reasons,
    policyVersion: VISION_POLICY.version,
    recovery: {
      action,
      automatic,
      requiresExpert,
      attempt,
      maxAttempts: VISION_POLICY.maxAttempts,
      instruction,
    },
  };
}

export function evaluateVisionGate(input: VisionGateInput): VisionGateDecision {
  const attempt = Math.max(1, input.attempt);
  const safetyReasons: GateReason[] = [];

  if (input.policyVersion !== VISION_POLICY.version) {
    safetyReasons.push("POLICY_VERSION_MISMATCH");
  }
  if (
    !input.observedCoreId ||
    !input.observedSlideId ||
    input.identityConfidence === null
  ) {
    safetyReasons.push("IDENTITY_MISSING");
  } else {
    if (
      input.observedCoreId !== input.expectedCoreId ||
      input.observedSlideId !== input.expectedSlideId
    ) {
      safetyReasons.push("IDENTITY_MISMATCH");
    }
    if (
      input.identityConfidence <
      VISION_POLICY.thresholds.identityConfidenceMin
    ) {
      safetyReasons.push("IDENTITY_CONFIDENCE_LOW");
    }
  }
  if (!input.provenanceValid) safetyReasons.push("PROVENANCE_INVALID");

  if (safetyReasons.length > 0) {
    const quarantine = safetyReasons.some((reason) =>
      ["IDENTITY_MISMATCH", "PROVENANCE_INVALID"].includes(reason)
    );
    return recovery(
      "HOLD",
      safetyReasons,
      quarantine ? "QUARANTINE" : "EXPERT_REVIEW",
      false,
      true,
      attempt,
      quarantine
        ? "Quarantine the acquisition. Reconcile physical labels and the hash chain; never relabel evidence automatically."
        : "A domain expert must reconcile identity evidence and the active policy before release."
    );
  }

  if (input.expertOverride === "FAIL") {
    return recovery(
      "HOLD",
      ["EXPERT_REJECTED"],
      "EXPERT_REVIEW",
      false,
      true,
      attempt,
      "Keep the acquisition on hold and follow the expert's recorded disposition."
    );
  }
  if (input.expertOverride === "PASS") {
    if ((input.expertNote?.trim().length ?? 0) < 8) {
      return recovery(
        "HOLD",
        ["EXPERT_RATIONALE_REQUIRED"],
        "EXPERT_REVIEW",
        false,
        true,
        attempt,
        "Record a concise scientific rationale before accepting a metric exception."
      );
    }
    return recovery(
      "RELEASE",
      ["EXPERT_OVERRIDE_RECORDED"],
      "NONE",
      false,
      false,
      attempt,
      "Release under the recorded expert rationale; identity and provenance gates remain non-overridable."
    );
  }

  const metricReasons: GateReason[] = [];
  const { metrics } = input;
  if (metrics.focusScore < VISION_POLICY.thresholds.focusScoreMin) {
    metricReasons.push("FOCUS_LOW");
  }
  if (
    metrics.markerCompleteness <
    VISION_POLICY.thresholds.markerCompletenessMin
  ) {
    metricReasons.push("MARKER_DROPOUT");
  }
  if (metrics.saturationPct > VISION_POLICY.thresholds.saturationPctMax) {
    metricReasons.push("SATURATION_HIGH");
  }
  if (metrics.tissueLossPct > VISION_POLICY.thresholds.tissueLossPctMax) {
    metricReasons.push("TISSUE_LOSS_HIGH");
  }
  if (metrics.segSanity < VISION_POLICY.thresholds.segSanityMin) {
    metricReasons.push("SEGMENTATION_UNSTABLE");
  }
  if (metrics.foldScore > VISION_POLICY.thresholds.foldScoreMax) {
    metricReasons.push("FOLD_DETECTED");
  }

  if (metricReasons.length === 0) {
    return recovery(
      "RELEASE",
      [],
      "NONE",
      false,
      false,
      attempt,
      "All identity, provenance, and vision policy gates passed."
    );
  }

  if (metricReasons.includes("TISSUE_LOSS_HIGH") || metricReasons.includes("FOLD_DETECTED")) {
    return recovery(
      "HOLD",
      metricReasons,
      "RECUT",
      false,
      true,
      attempt,
      "A domain expert must assess remaining material before authorizing a new section."
    );
  }
  if (metricReasons.includes("MARKER_DROPOUT")) {
    return recovery(
      "HOLD",
      metricReasons,
      "RESTAIN",
      false,
      true,
      attempt,
      "Review controls and tissue availability before authorizing a restain."
    );
  }

  if (attempt >= VISION_POLICY.maxAttempts) {
    return recovery(
      "HOLD",
      [...metricReasons, "RETRY_BUDGET_EXHAUSTED"],
      "EXPERT_REVIEW",
      false,
      true,
      attempt,
      "Stop automatic recovery. A domain expert must choose the next disposition."
    );
  }

  const reprocessOnly = metricReasons.every(
    (reason) => reason === "SEGMENTATION_UNSTABLE"
  );
  return recovery(
    "RETRY",
    metricReasons,
    reprocessOnly ? "REPROCESS" : "RESCAN",
    true,
    false,
    attempt,
    reprocessOnly
      ? "Re-run segmentation once with the validated fallback profile, then re-evaluate every gate."
      : "Reacquire once with validated focus/exposure adjustments, then re-evaluate every gate."
  );
}
