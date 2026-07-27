"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRunDetail } from "@/lib/queries";

// Release is fail-closed: identity/provenance failures and unresolved recovery
// steps cannot be converted into passes by a batch action.
export async function approveRun(runId: string) {
  const detail = await getRunDetail(runId);
  if (!detail) return { ok: false, message: "Assay run not found." };
  const blockers = detail.cores.filter((core) => core.gate.state !== "RELEASE");
  if (blockers.length > 0) {
    return {
      ok: false,
      message: `Release blocked: ${blockers.length} acquisition${blockers.length === 1 ? "" : "s"} require recovery or expert disposition.`,
    };
  }

  await prisma.$transaction([
    prisma.qCResult.updateMany({
      where: { id: { in: detail.cores.map((core) => core.qcId) } },
      data: { reviewed: true },
    }),
    prisma.assayRun.update({ where: { id: runId }, data: { status: "DONE" } }),
  ]);

  revalidatePath("/imaging-qc");
  revalidatePath("/command-center");
  revalidatePath("/");
  return { ok: true, message: "Run released under the active vision policy." };
}

// Manual per-core override from the detail drawer.
export async function overrideCore(qcId: string, verdict: "PASS" | "FAIL", note: string) {
  const rationale = note.trim();
  if (verdict === "PASS" && rationale.length < 8) {
    return {
      ok: false,
      message: "A pass override requires a concise scientific rationale.",
    };
  }
  await prisma.qCResult.update({
    where: { id: qcId },
    data: { overrideVerdict: verdict, reviewed: true, note: rationale || null },
  });
  revalidatePath("/imaging-qc");
  revalidatePath("/command-center");
  return { ok: true, message: "Expert disposition recorded." };
}
