"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shuffle, Sparkles, Download, RotateCcw } from "lucide-react";
import {
  buildLayout,
  optimizeLayout,
  layoutToJson,
  layoutToPicklistCsv,
  type LayoutResult,
  type PatientCore,
  type Well,
} from "@/lib/tma";
import { INDICATION_COLORS, type Indication } from "@/lib/constants";
import { colorFromString } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";

type PoolSpecimen = {
  id: string;
  patientCode: string;
  indication: string;
  cohort: string;
};

type ColorMode = "patient" | "indication" | "batch";

const COHORT_COLORS: Record<string, string> = {
  "B-2026-Q2-01": "#0d9488",
  "B-2026-Q2-02": "#6366f1",
};

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Planner({ pool }: { pool: PoolSpecimen[] }) {
  const [cohort, setCohort] = useState("ALL");
  const [gridSize, setGridSize] = useState(12);
  const [coresPerPatient, setCoresPerPatient] = useState(3);
  const [controlEvery, setControlEvery] = useState(12);
  const [colorMode, setColorMode] = useState<ColorMode>("patient");
  const [showControls, setShowControls] = useState(true);
  const [seed, setSeed] = useState(1);
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [hover, setHover] = useState<Well | null>(null);
  const optimizeToken = useRef(0);

  const specimens = useMemo(
    () => (cohort === "ALL" ? pool : pool.filter((s) => s.cohort === cohort)),
    [pool, cohort]
  );

  // Expand the selected specimens into a core pool: coresPerPatient each.
  const cores = useMemo<PatientCore[]>(() => {
    const out: PatientCore[] = [];
    for (const s of specimens) {
      for (let k = 1; k <= coresPerPatient; k++) {
        out.push({
          coreId: `${s.id}-C${String(k).padStart(2, "0")}`,
          specimenId: s.id,
          patientCode: s.patientCode,
          indication: s.indication,
          label: `C${String(k).padStart(2, "0")}`,
        });
      }
    }
    return out;
  }, [specimens, coresPerPatient]);

  // Rebuild layout whenever inputs (including seed) change.
  useEffect(() => {
    optimizeToken.current++; // cancel any in-flight optimize
    setOptimizing(false);
    setLayout(
      buildLayout(cores, {
        rows: gridSize,
        cols: gridSize,
        controlEveryNWells: controlEvery,
        seed,
      })
    );
  }, [cores, gridSize, controlEvery, seed]);

  async function runOptimize() {
    if (!layout || optimizing) return;
    setOptimizing(true);
    const token = ++optimizeToken.current;
    let working = layout;
    // Animate: several chunks, bumping the seed each time so swaps keep
    // exploring; the score visibly climbs.
    for (let chunk = 0; chunk < 16; chunk++) {
      if (optimizeToken.current !== token) return; // superseded
      working = optimizeLayout(
        { ...working, config: { ...working.config, seed: working.config.seed + 1 } },
        60
      );
      setLayout(working);
      await sleep(45);
    }
    if (optimizeToken.current === token) setOptimizing(false);
  }

  const capacity = gridSize * gridSize;
  const controlCount = layout?.controlCount ?? 0;
  const sampleCapacity = capacity - controlCount;

  function wellColor(w: Well): string {
    if (w.isControl) return showControls ? "hsl(200 18% 22%)" : "hsl(200 16% 92%)";
    if (!w.coreId) return "transparent";
    if (colorMode === "indication")
      return INDICATION_COLORS[w.indication as Indication] ?? "#94a3b8";
    if (colorMode === "batch") {
      const s = specimens.find((x) => x.id === w.specimenId);
      return s ? COHORT_COLORS[s.cohort] ?? "#94a3b8" : "#94a3b8";
    }
    return colorFromString(w.specimenId ?? "");
  }

  const score = layout?.score;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Configure the array build.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cohort / batch</Label>
              <Select value={cohort} onChange={(e) => setCohort(e.target.value)}>
                <option value="ALL">All fit-for-purpose ({pool.length})</option>
                <option value="B-2026-Q2-01">
                  Batch 01 ({pool.filter((s) => s.cohort === "B-2026-Q2-01").length})
                </option>
                <option value="B-2026-Q2-02">
                  Batch 02 ({pool.filter((s) => s.cohort === "B-2026-Q2-02").length})
                </option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Grid size</Label>
              <Select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
              >
                {[10, 11, 12, 14].map((n) => (
                  <option key={n} value={n}>
                    {n} x {n} ({n * n} wells)
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cores per patient</Label>
              <Select
                value={coresPerPatient}
                onChange={(e) => setCoresPerPatient(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Control cadence</Label>
              <Select
                value={controlEvery}
                onChange={(e) => setControlEvery(Number(e.target.value))}
              >
                <option value={0}>No controls</option>
                {[8, 10, 12, 16].map((n) => (
                  <option key={n} value={n}>
                    Every {n} wells
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={() => setSeed((s) => s + 1)} variant="secondary">
              <Shuffle className="size-4" />
              Re-randomize
            </Button>
            <Button className="w-full" onClick={runOptimize} disabled={optimizing}>
              <Sparkles className="size-4" />
              {optimizing ? "Optimizing..." : "Optimize"}
            </Button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  layout &&
                  download(
                    "layout.json",
                    JSON.stringify(layoutToJson(layout, `TMA-${gridSize}x${gridSize}`), null, 2),
                    "application/json"
                  )
                }
              >
                <Download className="size-4" />
                layout.json
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  layout &&
                  download(
                    "picklist.csv",
                    layoutToPicklistCsv(layout, `TMA-${gridSize}x${gridSize}`),
                    "text/csv"
                  )
                }
              >
                <Download className="size-4" />
                picklist.csv
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid + score */}
      <div className="space-y-4">
        {/* Score bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 p-5">
            <ScoreRing value={score?.overall ?? 0} optimizing={optimizing} />
            <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              <Metric
                label="Same-patient spread"
                value={score ? `${score.meanNearestNeighbor.toFixed(2)}` : "-"}
                sub="mean nearest-neighbor (wells)"
              />
              <Metric
                label="Indication evenness"
                value={score ? `${Math.round(score.indicationEvenness * 100)}%` : "-"}
                sub="across quadrants"
              />
              <Metric
                label="Placed"
                value={layout ? `${layout.placedCores}` : "-"}
                sub={`of ${sampleCapacity} sample wells`}
              />
              <Metric
                label="Controls"
                value={`${controlCount}`}
                sub="reference cores"
              />
              <Metric label="Patients" value={`${specimens.length}`} sub="in cohort" />
              <Metric label="Cores pooled" value={`${cores.length}`} sub="available" />
            </div>
          </CardContent>
        </Card>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={colorMode}
            onChange={(v) => setColorMode(v as ColorMode)}
            options={[
              { value: "patient", label: "By patient" },
              { value: "indication", label: "By indication" },
              { value: "batch", label: "By batch" },
            ]}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showControls}
              onChange={(e) => setShowControls(e.target.checked)}
              className="size-3.5 accent-[hsl(174_82%_28%)]"
            />
            Show controls
          </label>
        </div>

        {/* Grid */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div
                className="grid flex-1 gap-1"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                onMouseLeave={() => setHover(null)}
              >
                {layout?.wells.map((w) => {
                  const empty = !w.coreId && !w.isControl;
                  return (
                    <div
                      key={`${w.row}-${w.col}`}
                      className="aspect-square rounded-full border transition-transform hover:scale-110"
                      style={{
                        background: wellColor(w),
                        borderColor: empty
                          ? "hsl(200 16% 88%)"
                          : w.isControl && showControls
                            ? "hsl(200 18% 22%)"
                            : "transparent",
                        borderStyle: empty ? "dashed" : "solid",
                        boxShadow:
                          hover && hover.row === w.row && hover.col === w.col
                            ? "0 0 0 2px hsl(174 82% 32%)"
                            : "none",
                      }}
                      onMouseEnter={() => setHover(w)}
                      title={
                        w.isControl
                          ? `Control - ${w.controlType} - R${w.row + 1}-C${w.col + 1}`
                          : w.coreId
                            ? `${w.specimenId} ${w.label} - ${w.indication} - R${w.row + 1}-C${w.col + 1}`
                            : `Empty - R${w.row + 1}-C${w.col + 1}`
                      }
                    />
                  );
                })}
              </div>

              {/* Inspector */}
              <div className="w-full shrink-0 lg:w-52">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="eyebrow mb-2">Well inspector</div>
                  {!hover && (
                    <div className="text-muted-foreground">Hover a well to inspect.</div>
                  )}
                  {hover && (
                    <div className="space-y-1.5">
                      <div className="font-mono text-xs text-muted-foreground">
                        R{hover.row + 1} - C{hover.col + 1}
                      </div>
                      {hover.isControl ? (
                        <>
                          <div className="font-semibold">Control core</div>
                          <div className="text-muted-foreground">{hover.controlType}</div>
                        </>
                      ) : hover.coreId ? (
                        <>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span
                              className="size-2.5 rounded-full"
                              style={{
                                background:
                                  INDICATION_COLORS[hover.indication as Indication],
                              }}
                            />
                            {hover.indication}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {hover.specimenId} - {hover.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {hover.patientCode}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">Empty well</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="mt-3 rounded-lg border border-border p-3">
                  <div className="eyebrow mb-2">Legend</div>
                  <Legend colorMode={colorMode} specimens={specimens} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="size-3" />
          The optimizer runs in TypeScript for this demo. In production it would be a
          Python/FastAPI service alongside the scientific stack.
        </p>
      </div>
    </div>
  );
}

function ScoreRing({ value, optimizing }: { value: number; optimizing: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color =
    value >= 80 ? "hsl(152 58% 40%)" : value >= 60 ? "hsl(38 92% 48%)" : "hsl(350 74% 52%)";
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(200 16% 90%)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.35s ease, stroke 0.35s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-semibold tabular">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {optimizing ? "tuning" : "score"}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Legend({
  colorMode,
  specimens,
}: {
  colorMode: ColorMode;
  specimens: PoolSpecimen[];
}) {
  if (colorMode === "indication") {
    const present = Array.from(new Set(specimens.map((s) => s.indication)));
    return (
      <div className="space-y-1.5">
        {present.map((ind) => (
          <div key={ind} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 rounded-full"
              style={{ background: INDICATION_COLORS[ind as Indication] }}
            />
            {ind}
          </div>
        ))}
      </div>
    );
  }
  if (colorMode === "batch") {
    return (
      <div className="space-y-1.5">
        {Object.entries(COHORT_COLORS).map(([b, c]) => (
          <div key={b} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: c }} />
            {b}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-[hsl(200_18%_22%)]" />
        Control core
      </div>
      <div>Each hue is one patient - spread across the array.</div>
    </div>
  );
}
