import { Microscope, ShieldCheck, Boxes, TrendingUp } from "lucide-react";
import { getCommandCenterData } from "@/lib/queries";
import { PageHeader, DemoBadge } from "@/components/layout/topbar";
import { KpiCard } from "@/components/ui/kpi";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PipelineBoard } from "@/components/command-center/pipeline-board";
import { InventoryTable } from "@/components/command-center/inventory-table";
import { ThroughputChart, IndicationBarChart } from "@/components/charts/charts";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const data = await getCommandCenterData();
  const { kpis } = data;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Module 1"
        title="Command Center"
        description="The system of record for the lab - every specimen, batch and QC verdict in one place."
        right={<DemoBadge />}
      />

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Patients profiled"
          value={kpis.totalSpecimens}
          delta={{ value: `${kpis.thisWeek} new`, direction: "up" }}
          hint="This week"
          icon={<Microscope className="size-4" />}
        />
        <KpiCard
          label="QC pass rate"
          value={`${kpis.qcPassRate}%`}
          hint="Across imaged cores"
          icon={<ShieldCheck className="size-4" />}
        />
        <KpiCard
          label="Active batches"
          value={kpis.activeBatches}
          hint="Assay runs in progress"
          icon={<Boxes className="size-4" />}
        />
        <KpiCard
          label="Throughput"
          value={`${kpis.throughputTrend.at(-1)?.count ?? 0}/wk`}
          delta={{
            value: `${Math.abs(kpis.trendDelta)}%`,
            direction: kpis.trendDelta >= 0 ? "up" : "down",
          }}
          hint="vs prior 3 weeks"
          icon={<TrendingUp className="size-4" />}
        />
      </section>

      {/* Pipeline board */}
      <section className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Specimens by stage, from accessioning through data ingest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineBoard board={data.board} />
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
            <CardDescription>Patients accessioned per week, last 12 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThroughputChart data={data.throughput} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Samples by indication</CardTitle>
            <CardDescription>Tumor indication mix across the cohort.</CardDescription>
          </CardHeader>
          <CardContent>
            <IndicationBarChart data={data.byIndication} />
          </CardContent>
        </Card>
      </section>

      {/* Inventory */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Sample inventory</CardTitle>
            <CardDescription>
              Filter and drill into any specimen for full lineage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryTable rows={data.inventory} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
