import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProvenanceEvent,
  imageManifestSha256,
  verifyAcquisitionEvidence,
  verifyProvenanceChain,
} from "./provenance";

function chain() {
  const base = {
    specimenId: "SPC-0001",
    coreId: "SPC-0001-C01",
    slideId: "TMA-A-mIF",
    assayRunId: "AR-mIF-014",
    occurredAt: "2026-07-01T12:00:00.000Z",
  };
  const first = appendProvenanceEvent(
    {
      ...base,
      id: "event-1",
      sequence: 1,
      eventType: "SPECIMEN_ID_BOUND",
      actor: "accession.station",
      payload: { expectedCoreId: base.coreId },
    },
    null
  );
  const second = appendProvenanceEvent(
    {
      ...base,
      id: "event-2",
      sequence: 2,
      eventType: "IMAGE_ACQUIRED",
      actor: "scanner.synthetic",
      payload: { acquisitionId: "ACQ-001" },
    },
    first.eventHash
  );
  return [first, second];
}

test("verifies an intact acquisition chain", () => {
  const result = verifyProvenanceChain(chain());
  assert.equal(result.valid, true);
  assert.equal(result.eventCount, 2);
  assert.equal(result.head, chain()[1].eventHash);
});

test("detects payload tampering", () => {
  const events = chain();
  events[1] = { ...events[1], payloadJson: '{"acquisitionId":"other"}' };
  const result = verifyProvenanceChain(events);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /hash does not match/);
});

test("image manifest hashes are deterministic and bind acquisition metadata", () => {
  const input = {
    acquisitionId: "ACQ-001",
    channel: "DAPI",
    uri: "synthetic://image/DAPI.ome.tiff",
    capturedAt: "2026-07-01T12:00:00.000Z",
  };
  assert.equal(imageManifestSha256(input), imageManifestSha256({ ...input }));
  assert.notEqual(
    imageManifestSha256(input),
    imageManifestSha256({ ...input, channel: "CD8" })
  );
});

test("verifies that chained payloads match image and QC records", () => {
  const capturedAt = "2026-07-01T12:00:00.000Z";
  const image = {
    acquisitionId: "ACQ-001",
    channel: "DAPI",
    uri: "synthetic://image/DAPI.ome.tiff",
    capturedAt,
    manifestSha256: "",
  };
  image.manifestSha256 = imageManifestSha256({
    acquisitionId: image.acquisitionId,
    channel: image.channel,
    uri: image.uri,
    capturedAt: image.capturedAt,
  });
  const expected = {
    specimenId: "SPC-0001",
    coreId: "SPC-0001-C01",
    slideId: "TMA-A-mIF",
    assayRunId: "AR-mIF-014",
    acquisitionId: "ACQ-001",
    observedCoreId: "SPC-0001-C01",
    observedSlideId: "TMA-A-mIF",
    identityConfidence: 0.995,
    metrics: {
      focusScore: 0.95,
      markerCompleteness: 0.98,
      saturationPct: 1.2,
      tissueLossPct: 2,
      segSanity: 0.93,
      foldScore: 0.04,
    },
    verdict: "PASS",
    policyVersion: "spatial-qc-v1",
  };
  const definitions = [
    {
      eventType: "SPECIMEN_ID_BOUND",
      payload: {
        specimenId: expected.specimenId,
        coreId: expected.coreId,
        evidenceKind: "SYNTHETIC_DEMO",
      },
    },
    {
      eventType: "TMA_POSITION_BOUND",
      payload: { tmaId: "TMA-A", row: 1, col: 2, evidenceKind: "SYNTHETIC_DEMO" },
    },
    {
      eventType: "IMAGE_ACQUIRED",
      payload: {
        acquisitionId: expected.acquisitionId,
        observedCoreId: expected.observedCoreId,
        observedSlideId: expected.observedSlideId,
        identityConfidence: expected.identityConfidence,
        manifestHashes: [image.manifestSha256],
        evidenceKind: "SYNTHETIC_DEMO",
      },
    },
    {
      eventType: "VISION_QC_EVALUATED",
      payload: {
        metrics: expected.metrics,
        verdict: expected.verdict,
        policyVersion: expected.policyVersion,
        evidenceKind: "SYNTHETIC_DEMO",
      },
    },
  ];
  let previousHash: string | null = null;
  const events = definitions.map((definition, index) => {
    const event = appendProvenanceEvent(
      {
        id: `event-${index + 1}`,
        specimenId: expected.specimenId,
        coreId: expected.coreId,
        slideId: expected.slideId,
        assayRunId: expected.assayRunId,
        sequence: index + 1,
        eventType: definition.eventType,
        actor: "synthetic.fixture",
        occurredAt: capturedAt,
        payload: definition.payload,
      },
      previousHash
    );
    previousHash = event.eventHash;
    return event;
  });

  const valid = verifyAcquisitionEvidence({ events, images: [image], expected });
  assert.equal(valid.valid, true);

  const changedQc = verifyAcquisitionEvidence({
    events,
    images: [image],
    expected: { ...expected, metrics: { ...expected.metrics, focusScore: 0.2 } },
  });
  assert.equal(changedQc.valid, false);
  assert.match(changedQc.errors.join(" "), /payload does not match/);
});
