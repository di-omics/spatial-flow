"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
  INDICATIONS,
  STAGE_LABELS,
  INDICATION_COLORS,
  type Indication,
  type Stage,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  patientCode: string;
  indication: string;
  sourceDate: string;
  ischemiaMinutes: number;
  necrosisPct: number;
  qcStatus: string;
  stage: string;
  cores: number;
};

export function InventoryTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [indication, setIndication] = useState("ALL");
  const [qc, setQc] = useState("ALL");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (indication !== "ALL" && r.indication !== indication) return false;
      if (qc !== "ALL" && r.qcStatus !== qc) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !r.id.toLowerCase().includes(needle) &&
          !r.patientCode.toLowerCase().includes(needle) &&
          !r.indication.toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [rows, q, indication, qc]);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search specimen, patient, indication..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={indication}
            onChange={(e) => setIndication(e.target.value)}
            className="sm:w-40"
            aria-label="Filter by indication"
          >
            <option value="ALL">All indications</option>
            {INDICATIONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
          <Select
            value={qc}
            onChange={(e) => setQc(e.target.value)}
            className="sm:w-36"
            aria-label="Filter by QC status"
          >
            <option value="ALL">All QC</option>
            <option value="PASS">Pass</option>
            <option value="REVIEW">Review</option>
            <option value="FAIL">Fail</option>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Specimen</TableHead>
              <TableHead>Indication</TableHead>
              <TableHead className="hidden md:table-cell">Received</TableHead>
              <TableHead className="hidden lg:table-cell">Ischemia</TableHead>
              <TableHead className="hidden lg:table-cell">Necrosis</TableHead>
              <TableHead>Cores</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>QC</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="group cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/command-center/${r.id}`} className="block">
                    {r.id}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {r.patientCode}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        background: INDICATION_COLORS[r.indication as Indication],
                      }}
                    />
                    {r.indication}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(r.sourceDate)}
                </TableCell>
                <TableCell className="hidden tabular lg:table-cell">
                  {r.ischemiaMinutes}m
                </TableCell>
                <TableCell className="hidden tabular lg:table-cell">
                  {r.necrosisPct}%
                </TableCell>
                <TableCell className="tabular">{r.cores}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {STAGE_LABELS[r.stage as Stage]}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.qcStatus} />
                </TableCell>
                <TableCell>
                  <Link href={`/command-center/${r.id}`}>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No specimens match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {filtered.length} of {rows.length} specimens
      </div>
    </div>
  );
}
