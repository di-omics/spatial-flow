import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateVisionGate,
  VISION_POLICY,
  type VisionGateInput,
} from "./vision-gate";

const passingInput: VisionGateInput = {
  policyVersion: VISION_POLICY.version,
  expectedCoreId: "SPC-0001-C01",
  expectedSlideId: "TMA-A-mIF",
  observedCoreId: "SPC-0001-C01",
  observedSlideId: "TMA-A-mIF",
  identityConfidence: 0.997,
  provenanceValid: true,
  attempt: 1,
  metrics: {
    focusScore: 0.95,
    markerCompleteness: 0.98,
    saturationPct: 1.2,
    tissueLossPct: 2,
    segSanity: 0.93,
    foldScore: 0.04,
  },
};

test("releases only when identity, provenance, and metrics pass", () => {
  const result = evaluateVisionGate(passingInput);
  assert.equal(result.state, "RELEASE");
  assert.equal(result.recovery.action, "NONE");
});

test("identity mismatch is non-overridable and quarantines evidence", () => {
  const result = evaluateVisionGate({
    ...passingInput,
    observedCoreId: "SPC-0002-C01",
    expertOverride: "PASS",
    expertNote: "Morphology confirms the expected specimen.",
  });
  assert.equal(result.state, "HOLD");
  assert.equal(result.recovery.action, "QUARANTINE");
  assert.equal(result.recovery.automatic, false);
  assert.ok(result.reasons.includes("IDENTITY_MISMATCH"));
});

test("a recoverable focus failure gets one bounded rescan", () => {
  const result = evaluateVisionGate({
    ...passingInput,
    metrics: { ...passingInput.metrics, focusScore: 0.62 },
  });
  assert.equal(result.state, "RETRY");
  assert.equal(result.recovery.action, "RESCAN");
  assert.equal(result.recovery.automatic, true);
});

test("retry exhaustion stops and escalates to an expert", () => {
  const result = evaluateVisionGate({
    ...passingInput,
    attempt: 2,
    metrics: { ...passingInput.metrics, focusScore: 0.62 },
  });
  assert.equal(result.state, "HOLD");
  assert.equal(result.recovery.action, "EXPERT_REVIEW");
  assert.ok(result.reasons.includes("RETRY_BUDGET_EXHAUSTED"));
});

test("irreversible tissue loss requires expert-authorized recutting", () => {
  const result = evaluateVisionGate({
    ...passingInput,
    metrics: { ...passingInput.metrics, tissueLossPct: 18 },
  });
  assert.equal(result.state, "HOLD");
  assert.equal(result.recovery.action, "RECUT");
  assert.equal(result.recovery.requiresExpert, true);
});

test("metric overrides require rationale but cannot bypass safety gates", () => {
  const noRationale = evaluateVisionGate({
    ...passingInput,
    metrics: { ...passingInput.metrics, segSanity: 0.6 },
    expertOverride: "PASS",
  });
  assert.equal(noRationale.state, "HOLD");
  assert.ok(noRationale.reasons.includes("EXPERT_RATIONALE_REQUIRED"));

  const accepted = evaluateVisionGate({
    ...passingInput,
    metrics: { ...passingInput.metrics, segSanity: 0.6 },
    expertOverride: "PASS",
    expertNote: "Artifact is outside the tissue region used downstream.",
  });
  assert.equal(accepted.state, "RELEASE");
  assert.ok(accepted.reasons.includes("EXPERT_OVERRIDE_RECORDED"));
});
