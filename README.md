# SpatialFlow

**Automated operations for a high-throughput spatial-biology wet lab - demo.**

SpatialFlow is a clickable demo of an operations platform for a lab that profiles
human tumor tissue at scale. It runs entirely on procedurally-generated synthetic
data: no real backend lab, no real specimens, no real images.

The central idea is that autonomy comes from encoding a domain expert's release and
recovery policy around existing instruments - not from hiding the wet lab behind a
generic "AI-native" label. Every automatic action is bounded; identity, provenance,
and irreversible sample decisions fail closed.

## What this demonstrates

A lab that profiles tumor tissue has to coordinate a long pipeline - accession and
QC each specimen, cut it into cores, arrange ~130 cores onto a tissue microarray
(TMA) with every patient deliberately spread across slides to minimize batch
effects, run three imaging assays on adjacent sections (multiplex immunofluorescence,
H&E, and imaging-based spatial transcriptomics), QC the images, and ingest
everything for ML. Today that coordination usually lives in spreadsheets.
SpatialFlow shows what it looks like when the software layer around that pipeline is
automated: a **Command Center** system-of-record with full specimen lineage, a
**TMA randomization planner** that spreads cores and scores the batch balance, and
an **Imaging QC** dashboard that combines synthetic vision metrics with sample
identity, tamper-evident provenance, and explicit recovery decisions.

## Run it

```bash
npm install     # installs deps and generates the Prisma client
npm run seed    # creates the SQLite DB and fills it with synthetic data
npm run dev     # http://localhost:3000
```

Zero external infrastructure - the data store is a local SQLite file.
The repository is continuously checked on Node 22; `npm test` runs the policy and
provenance unit tests.

## The three modules

1. **Command Center** - KPIs (patients profiled, QC pass rate, active batches,
   weekly throughput), a pipeline board, throughput/indication charts, and a
   filterable sample inventory. Click any specimen for full lineage
   (patient -> cores -> TMA position -> slides -> image files) with a generated
   specimen barcode/QR label.
2. **TMA Layout & Randomization** - pick a cohort, grid size, cores-per-patient and
   control cadence; the optimizer spreads each patient's cores across the array and
   inserts controls, then reports a **batch-balance score** (same-patient spread +
   indication evenness). Re-randomize for a new layout, Optimize to hill-climb the
   score live, and export `layout.json` + `picklist.csv`.
3. **Imaging QC & release control** - pick an assay run to see a grid of
   procedurally-generated core thumbnails (toggle mIF marker channels). Each
   acquisition binds its expected and synthetically observed labels, image manifests,
   append-only provenance events, and synthetic focus / marker-completeness /
   saturation / tissue-loss / segmentation / fold metrics. The versioned policy
   routes each core to `RELEASE`, bounded `RETRY`, or expert `HOLD`; the server blocks
   run release while any unresolved recovery remains.

## Domain-expert vision gate

[`src/lib/vision-gate.ts`](src/lib/vision-gate.ts) is the inspectable policy boundary
between computer-vision evidence and lab execution. For every acquisition it:

1. compares expected core/slide identity with observed label evidence;
2. verifies every synthetic image-manifest digest and the acquisition's SHA-256 event
   chain;
3. evaluates assay-agnostic image metrics against versioned thresholds; and
4. returns an explicit recovery action, retry budget, and authorization requirement.

| Finding | Decision | Recovery authority |
| --- | --- | --- |
| All gates pass | `RELEASE` | None |
| Focus/exposure or segmentation failure, first attempt | `RETRY` | One bounded rescan/reprocess |
| Marker dropout | `HOLD` | Expert-authorized restain |
| Tissue loss or fold | `HOLD` | Expert assesses material before recut |
| Identity mismatch or broken provenance | `HOLD` | Quarantine; never relabel automatically |
| Retry budget exhausted | `HOLD` | Expert chooses disposition |

A domain expert can accept a **metric** exception only with a written rationale.
Identity and provenance failures are deliberately non-overridable. These rules are a
software safety contract for the demo, not a clinically validated QC policy.

## Provenance model

Each seeded synthetic acquisition has four append-only events:
`SPECIMEN_ID_BOUND -> TMA_POSITION_BOUND -> IMAGE_ACQUIRED -> VISION_QC_EVALUATED`.
Every event hashes its canonical payload, acquisition identity, prior event hash,
actor, and timestamp. Image rows separately store a digest of their synthetic
manifest (URI, channel, acquisition ID, and capture time). Both are recomputed before
the release policy runs; changing evidence without rebuilding the chain produces a
hold.

## Renaming

The product name lives in one place - `APP_NAME` in
[`src/lib/constants.ts`](src/lib/constants.ts). Change it there and it updates
everywhere in the UI.

## Stack

Next.js 14 (App Router) - TypeScript - Tailwind CSS - Recharts - Prisma + SQLite.

The TMA randomization optimizer ([`src/lib/tma.ts`](src/lib/tma.ts)) runs in
TypeScript so it can execute live in the browser for the demo. In production it would
be ported to a Python/FastAPI service to sit alongside the scientific stack.

## Notes

- **All data is synthetic**, generated deterministically by
  [`prisma/seed.ts`](prisma/seed.ts). A "Demo data" badge is shown throughout.
- Placeholder tissue/marker images are procedurally-generated gradient tiles - no
  real histology.
- There is no trained computer-vision model, barcode reader, microscope, robotic
  workcell, or LIMS connection in this repository. "Observed" identities, confidence
  values, image metrics, image URIs, and recovery scenarios are deterministic demo
  fixtures used to exercise orchestration logic.
- Thresholds and recovery rules are engineering examples. They have not been
  validated for research, diagnostic, or clinical use.

## Data model

`Specimen -> Core -> CorePlacement (TMA) -> Slide -> ImageFile / QCResult`, with
`AssayRun` grouping slides and `ProvenanceEvent` binding acquisition evidence into a
hash chain. See [`prisma/schema.prisma`](prisma/schema.prisma).
