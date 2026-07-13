import Link from "next/link";
import {
  LayoutDashboard,
  Grid3x3,
  ScanEye,
  ArrowRight,
  Microscope,
  Layers,
  Boxes,
  ShieldCheck,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE, STAGES, STAGE_LABELS } from "@/lib/constants";
import { getCommandCenterData } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi";
import { DemoBadge } from "@/components/layout/topbar";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    href: "/command-center",
    icon: LayoutDashboard,
    title: "Command Center",
    desc: "System of record and live dashboard. Track every specimen from accessioning to ingestion, with full lineage down to the image file.",
  },
  {
    href: "/tma-planner",
    icon: Grid3x3,
    title: "TMA Layout & Randomization",
    desc: "Spread each patient's cores across the array to minimize batch effects, score the balance, and export a machine-readable build list.",
  },
  {
    href: "/imaging-qc",
    icon: ScanEye,
    title: "Imaging QC",
    desc: "Auto-score every core across mIF, H&E and spatial transcriptomics, triage what needs review, and approve batches in one click.",
  },
];

export default async function OverviewPage() {
  const data = await getCommandCenterData();
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-card sm:p-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, hsl(174 60% 90%), transparent)",
          }}
        />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="eyebrow">Spatial biology operations</span>
            <DemoBadge />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {APP_NAME}
          </h1>
          <p className="mt-3 text-base text-muted-foreground text-balance">
            {APP_TAGLINE}. One platform to accession specimens, plan tissue
            microarrays, run multiplex imaging, and QC every core - replacing the
            spreadsheets that coordinate a high-throughput wet lab.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/command-center">
              <Button size="lg">
                Open Command Center
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/tma-planner">
              <Button size="lg" variant="outline">
                Plan a TMA
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Patients profiled"
          value={data.kpis.totalSpecimens}
          hint={`${data.kpis.thisWeek} accessioned this week`}
          icon={<Microscope className="size-4" />}
        />
        <KpiCard
          label="QC pass rate"
          value={`${data.kpis.qcPassRate}%`}
          hint="Across imaged cores"
          icon={<ShieldCheck className="size-4" />}
        />
        <KpiCard
          label="Active batches"
          value={data.kpis.activeBatches}
          hint="Assay runs in progress"
          icon={<Boxes className="size-4" />}
        />
        <KpiCard
          label="Weekly throughput"
          value={data.kpis.throughputTrend.at(-1)?.count ?? 0}
          delta={{
            value: `${Math.abs(data.kpis.trendDelta)}%`,
            direction: data.kpis.trendDelta >= 0 ? "up" : "down",
          }}
          hint="Patients / week"
          icon={<Layers className="size-4" />}
        />
      </section>

      {/* Modules */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href} className="group">
              <Card className="flex h-full flex-col p-6 transition-all hover:-translate-y-0.5 hover:shadow-pop">
                <div className="mb-4 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">{m.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{m.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
                  Open module
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      {/* Pipeline strip */}
      <section>
        <div className="eyebrow mb-3">The pipeline</div>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-2.5 py-1 font-medium">
                  {STAGE_LABELS[stage]}
                </span>
                {i < STAGES.length - 1 && (
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {APP_NAME} automates the software layer around this flow - coordination,
            randomization, QC and data ingest - so the bench stays focused on the science.
          </p>
        </Card>
      </section>
    </div>
  );
}
