# SpatialFlow

**Automated operations for a high-throughput spatial-biology wet lab - demo.**

SpatialFlow is a clickable demo of an operations platform for a lab that profiles
human tumor tissue at scale. It runs entirely on procedurally-generated synthetic
data: no real backend lab, no real specimens, no real images.

## What this demonstrates

A lab that profiles tumor tissue has to coordinate a long pipeline - accession and
QC each specimen, cut it into cores, arrange ~130 cores onto a tissue microarray
(TMA) with every patient deliberately spread across slides to minimize batch
effects, run 3 imaging assays on adjacent sections (multiplex immunofluorescence,
H&E, and imaging-based spatial transcriptomics), QC the images, and ingest
everything for ML. Today that coordination usually lives in spreadsheets.
SpatialFlow shows what it looks like when the software layer around that pipeline is
automated: a **Command Center** system-of-record with full specimen lineage, a
**TMA randomization planner** that spreads cores and scores the batch balance, and
an **Imaging QC** dashboard that auto-scores every core and lets a reviewer approve a
batch in one click.

## Run it

```bash
npm install     # installs deps and generates the Prisma client
npm run seed    # creates the SQLite DB and fills it with synthetic data
npm run dev     # http://localhost:3000
```

Zero external infrastructure - the data store is a local SQLite file.

## The 3 modules

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
3. **Imaging QC** - pick an assay run to see a grid of procedurally-generated core
   thumbnails (toggle mIF marker channels), each with an auto-computed PASS/FLAG/FAIL
   verdict from synthetic focus / marker-completeness / saturation / tissue-loss /
   segmentation metrics. Filter to what needs review, open a core for its metrics and
   a manual override, and **Approve batch** to clear the review queue.

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

## Data model

`Specimen -> Core -> CorePlacement (TMA) -> Slide -> ImageFile / QCResult`, with
`AssayRun` grouping slides. See [`prisma/schema.prisma`](prisma/schema.prisma).
