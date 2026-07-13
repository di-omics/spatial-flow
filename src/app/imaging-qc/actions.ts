"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Approve a run's review queue: mark everything reviewed, and pass any flags.
// Fails are left as fails (they need a re-cut, not a pass). This updates the
// pass rate shown on the Command Center.
export async function approveRun(runId: string) {
  const run = await prisma.assayRun.findUnique({
    where: { id: runId },
    include: { slides: { select: { id: true } } },
  });
  if (!run) return;
  const slideIds = run.slides.map((s) => s.id);

  await prisma.qCResult.updateMany({
    where: { slideId: { in: slideIds }, verdict: "FLAG", overrideVerdict: null },
    data: { overrideVerdict: "PASS" },
  });
  await prisma.qCResult.updateMany({
    where: { slideId: { in: slideIds }, verdict: { not: "FAIL" } },
    data: { reviewed: true },
  });
  await prisma.qCResult.updateMany({
    where: { slideId: { in: slideIds } },
    data: { reviewed: true },
  });
  if (run.status !== "DONE") {
    await prisma.assayRun.update({ where: { id: runId }, data: { status: "DONE" } });
  }

  revalidatePath("/imaging-qc");
  revalidatePath("/command-center");
  revalidatePath("/");
}

// Manual per-core override from the detail drawer.
export async function overrideCore(qcId: string, verdict: "PASS" | "FAIL", note: string) {
  await prisma.qCResult.update({
    where: { id: qcId },
    data: { overrideVerdict: verdict, reviewed: true, note: note || null },
  });
  revalidatePath("/imaging-qc");
  revalidatePath("/command-center");
}
