import { getPlannerData } from "@/lib/queries";
import { PageHeader, DemoBadge } from "@/components/layout/topbar";
import { Planner } from "@/components/tma/planner";

export const dynamic = "force-dynamic";

export default async function TmaPlannerPage() {
  const { pool } = await getPlannerData();
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Module 2"
        title="TMA Layout & Randomization"
        description="Spread each patient's cores across the array to minimize batch and positional effects, then export a machine-readable build list."
        right={<DemoBadge />}
      />
      <Planner pool={pool} />
    </div>
  );
}
