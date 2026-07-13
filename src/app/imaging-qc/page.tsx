import { getRunList, getRunDetail } from "@/lib/queries";
import { PageHeader, DemoBadge } from "@/components/layout/topbar";
import { QcDashboard } from "@/components/qc/qc-dashboard";

export const dynamic = "force-dynamic";

export default async function ImagingQcPage({
  searchParams,
}: {
  searchParams: { run?: string };
}) {
  const runs = await getRunList();
  // Default to the first run that already has imagery.
  const defaultRun = runs.find((r) => r.coreCount > 0) ?? runs[0];
  const selectedId = searchParams.run ?? defaultRun?.id ?? "";
  const detail = selectedId ? await getRunDetail(selectedId) : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Module 3"
        title="Imaging QC"
        description="Auto-score every core across multiplex IF, H&E and spatial transcriptomics, triage what needs review, and approve batches."
        right={<DemoBadge />}
      />
      <QcDashboard runs={runs} selectedId={selectedId} detail={detail} />
    </div>
  );
}
