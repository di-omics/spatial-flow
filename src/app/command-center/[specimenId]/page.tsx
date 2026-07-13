import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Scissors,
  Grid3x3,
  Layers,
  ImageIcon,
} from "lucide-react";
import { getSpecimenLineage } from "@/lib/queries";
import { STAGE_LABELS, INDICATION_COLORS, type Stage, type Indication } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Barcode, QrTag } from "@/components/brand/codes";
import { formatDate, classForVerdict } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LineagePage({
  params,
}: {
  params: { specimenId: string };
}) {
  const data = await getSpecimenLineage(params.specimenId);
  if (!data) notFound();
  const { specimen, cores, summary } = data;

  const rail = [
    { icon: User, label: "Patient", value: specimen.patientCode },
    { icon: Scissors, label: "Cores", value: `${summary.totalCores} cut` },
    { icon: Grid3x3, label: "On TMA", value: `${summary.placedCores} placed` },
    { icon: Layers, label: "Arrays", value: `${summary.tmas.length}` },
    { icon: ImageIcon, label: "Images", value: `${summary.imageCount}` },
  ];

  return (
    <div className="animate-fade-in">
      <Link
        href="/command-center"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Command Center
      </Link>

      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Specimen lineage</div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{specimen.id}</h1>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ background: INDICATION_COLORS[specimen.indication as Indication] }}
              />
              {specimen.indication}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{STAGE_LABELS[specimen.stage as Stage]}</Badge>
          <StatusBadge status={specimen.qcStatus} />
        </div>
      </div>

      {/* Lineage rail */}
      <div className="mb-6 flex items-stretch gap-2 overflow-x-auto scroll-thin">
        {rail.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-2">
              <Card className="flex w-36 shrink-0 flex-col gap-1 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span className="eyebrow">{step.label}</span>
                </div>
                <div className="text-sm font-semibold">{step.value}</div>
              </Card>
              {i < rail.length - 1 && (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Cores + placements */}
        <div className="order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Cores & TMA placement</CardTitle>
              <CardDescription>
                Each core and where it landed on an array - deliberately spread across
                batches to minimize positional effects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Core</TableHead>
                      <TableHead>Dia (mm)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Placement</TableHead>
                      <TableHead>QC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cores.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.label}</TableCell>
                        <TableCell className="tabular">{c.diameterMm.toFixed(1)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.status}
                        </TableCell>
                        <TableCell>
                          {c.placements.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            c.placements.map((p) => (
                              <span
                                key={p.tmaId}
                                className="mr-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {p.tmaName}
                                <span className="text-muted-foreground">
                                  R{p.row + 1}-C{p.col + 1}
                                </span>
                              </span>
                            ))
                          )}
                        </TableCell>
                        <TableCell>
                          {c.qc.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {c.qc.map((q, i) => (
                                <span
                                  key={i}
                                  className={`text-xs font-semibold ${classForVerdict(q.verdict)}`}
                                >
                                  {q.verdict}
                                </span>
                              ))}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metadata + label */}
        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Specimen label</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <QrTag value={specimen.id} />
              <div className="min-w-0 flex-1">
                <Barcode value={specimen.id} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accessioning & QC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row label="Patient" value={specimen.patientCode} />
              <Row label="Received" value={formatDate(specimen.sourceDate)} />
              <Row label="Ischemia time" value={`${specimen.ischemiaMinutes} min`} />
              <Row label="Necrosis" value={`${specimen.necrosisPct}%`} />
              <Row
                label="Fit for purpose"
                value={specimen.fitForPurpose ? "Yes" : "No"}
              />
              <Row
                label="Imaging QC"
                value={`${summary.qcPass}/${summary.qcTotal} pass`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arrays</CardTitle>
              <CardDescription>Batches this specimen appears on.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {summary.tmas.length === 0 && (
                <span className="text-sm text-muted-foreground">Not yet placed.</span>
              )}
              {summary.tmas.map((t) => (
                <div
                  key={t.id}
                  className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted-foreground">{t.batchId}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}
