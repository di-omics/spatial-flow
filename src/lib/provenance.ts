import { createHash } from "node:crypto";

export type ProvenanceEventRecord = {
  id: string;
  specimenId: string;
  coreId: string;
  slideId: string;
  assayRunId: string;
  sequence: number;
  eventType: string;
  actor: string;
  occurredAt: Date | string;
  payloadJson: string;
  previousHash: string | null;
  eventHash: string;
};

type NewProvenanceEvent = Omit<
  ProvenanceEventRecord,
  "payloadJson" | "previousHash" | "eventHash"
> & {
  payload: unknown;
};

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function eventHashInput(event: Omit<ProvenanceEventRecord, "eventHash">) {
  return canonicalJson({
    id: event.id,
    specimenId: event.specimenId,
    coreId: event.coreId,
    slideId: event.slideId,
    assayRunId: event.assayRunId,
    sequence: event.sequence,
    eventType: event.eventType,
    actor: event.actor,
    occurredAt:
      event.occurredAt instanceof Date
        ? event.occurredAt.toISOString()
        : event.occurredAt,
    payloadJson: event.payloadJson,
    previousHash: event.previousHash,
  });
}

export function appendProvenanceEvent(
  event: NewProvenanceEvent,
  previousHash: string | null
): ProvenanceEventRecord {
  const stored: Omit<ProvenanceEventRecord, "eventHash"> = {
    id: event.id,
    specimenId: event.specimenId,
    coreId: event.coreId,
    slideId: event.slideId,
    assayRunId: event.assayRunId,
    sequence: event.sequence,
    eventType: event.eventType,
    actor: event.actor,
    occurredAt: event.occurredAt,
    payloadJson: canonicalJson(event.payload),
    previousHash,
  };
  return { ...stored, eventHash: sha256Hex(eventHashInput(stored)) };
}

export function verifyProvenanceChain(events: ProvenanceEventRecord[]) {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const errors: string[] = [];
  let previousHash: string | null = null;
  const identity = ordered[0]
    ? {
        specimenId: ordered[0].specimenId,
        coreId: ordered[0].coreId,
        slideId: ordered[0].slideId,
        assayRunId: ordered[0].assayRunId,
      }
    : null;

  if (ordered.length === 0) errors.push("chain is empty");

  for (const [index, event] of ordered.entries()) {
    if (event.sequence !== index + 1) {
      errors.push(`expected sequence ${index + 1}, received ${event.sequence}`);
    }
    if (event.previousHash !== previousHash) {
      errors.push(`event ${event.sequence} does not link to the previous hash`);
    }
    if (
      identity &&
      (event.specimenId !== identity.specimenId ||
        event.coreId !== identity.coreId ||
        event.slideId !== identity.slideId ||
        event.assayRunId !== identity.assayRunId)
    ) {
      errors.push(`event ${event.sequence} changes acquisition identity`);
    }
    try {
      JSON.parse(event.payloadJson);
    } catch {
      errors.push(`event ${event.sequence} payload is not valid JSON`);
    }
    const expected = sha256Hex(
      eventHashInput({
        id: event.id,
        specimenId: event.specimenId,
        coreId: event.coreId,
        slideId: event.slideId,
        assayRunId: event.assayRunId,
        sequence: event.sequence,
        eventType: event.eventType,
        actor: event.actor,
        occurredAt: event.occurredAt,
        payloadJson: event.payloadJson,
        previousHash: event.previousHash,
      })
    );
    if (event.eventHash !== expected) {
      errors.push(`event ${event.sequence} hash does not match its contents`);
    }
    previousHash = event.eventHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    eventCount: ordered.length,
    head: ordered.at(-1)?.eventHash ?? null,
  };
}

export function imageManifestSha256(input: {
  acquisitionId: string;
  channel: string;
  uri: string;
  capturedAt: Date | string;
}): string {
  return sha256Hex(
    canonicalJson({
      acquisitionId: input.acquisitionId,
      channel: input.channel,
      uri: input.uri,
      capturedAt: input.capturedAt,
    })
  );
}

type AcquisitionImageRecord = {
  acquisitionId: string | null;
  channel: string;
  uri: string;
  capturedAt: Date | string | null;
  manifestSha256: string | null;
};

type AcquisitionEvidence = {
  specimenId: string;
  coreId: string;
  slideId: string;
  assayRunId: string;
  acquisitionId: string | null;
  observedCoreId: string | null;
  observedSlideId: string | null;
  identityConfidence: number | null;
  metrics: {
    focusScore: number;
    markerCompleteness: number;
    saturationPct: number;
    tissueLossPct: number;
    segSanity: number;
    foldScore: number;
  };
  verdict: string;
  policyVersion: string;
};

function payloadRecord(event: ProvenanceEventRecord | undefined) {
  if (!event) return null;
  try {
    const payload: unknown = JSON.parse(event.payloadJson);
    return payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function verifyAcquisitionEvidence(input: {
  events: ProvenanceEventRecord[];
  images: AcquisitionImageRecord[];
  expected: AcquisitionEvidence;
}) {
  const chain = verifyProvenanceChain(input.events);
  const ordered = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const expectedTypes = [
    "SPECIMEN_ID_BOUND",
    "TMA_POSITION_BOUND",
    "IMAGE_ACQUIRED",
    "VISION_QC_EVALUATED",
  ];
  const eventTypesValid =
    ordered.length === expectedTypes.length &&
    ordered.every((event, index) => event.eventType === expectedTypes[index]);
  const topLevelIdentityValid = ordered.every(
    (event) =>
      event.specimenId === input.expected.specimenId &&
      event.coreId === input.expected.coreId &&
      event.slideId === input.expected.slideId &&
      event.assayRunId === input.expected.assayRunId
  );

  const storedManifestHashes = input.images
    .map((image) => image.manifestSha256)
    .filter((value): value is string => value !== null)
    .sort();
  const manifestsValid =
    input.images.length > 0 &&
    input.images.every(
      (image) =>
        image.acquisitionId !== null &&
        image.capturedAt !== null &&
        image.manifestSha256 !== null &&
        image.acquisitionId === input.expected.acquisitionId &&
        image.manifestSha256 ===
          imageManifestSha256({
            acquisitionId: image.acquisitionId,
            channel: image.channel,
            uri: image.uri,
            capturedAt: image.capturedAt,
          })
    );

  const specimenPayload = payloadRecord(
    ordered.find((event) => event.eventType === "SPECIMEN_ID_BOUND")
  );
  const imagePayload = payloadRecord(
    ordered.find((event) => event.eventType === "IMAGE_ACQUIRED")
  );
  const qcPayload = payloadRecord(
    ordered.find((event) => event.eventType === "VISION_QC_EVALUATED")
  );
  const payloads = ordered.map((event) => payloadRecord(event));
  const bindingsValid =
    specimenPayload?.specimenId === input.expected.specimenId &&
    specimenPayload?.coreId === input.expected.coreId &&
    imagePayload?.acquisitionId === input.expected.acquisitionId &&
    imagePayload?.observedCoreId === input.expected.observedCoreId &&
    imagePayload?.observedSlideId === input.expected.observedSlideId &&
    imagePayload?.identityConfidence === input.expected.identityConfidence &&
    canonicalJson(imagePayload?.manifestHashes) === canonicalJson(storedManifestHashes) &&
    canonicalJson(qcPayload?.metrics) === canonicalJson(input.expected.metrics) &&
    qcPayload?.verdict === input.expected.verdict &&
    qcPayload?.policyVersion === input.expected.policyVersion;
  const syntheticEvidenceLabeled = payloads.every(
    (payload) => payload?.evidenceKind === "SYNTHETIC_DEMO"
  );

  const errors = [
    ...chain.errors,
    ...(eventTypesValid ? [] : ["acquisition event sequence is incomplete"]),
    ...(topLevelIdentityValid ? [] : ["provenance identity does not match the acquisition"]),
    ...(manifestsValid ? [] : ["image manifest verification failed"]),
    ...(bindingsValid ? [] : ["provenance payload does not match acquisition evidence"]),
    ...(syntheticEvidenceLabeled ? [] : ["synthetic evidence label is missing"]),
  ];

  return {
    valid: errors.length === 0,
    errors,
    eventCount: chain.eventCount,
    head: chain.head,
    chainValid: chain.valid,
    manifestsValid,
    bindingsValid,
  };
}
