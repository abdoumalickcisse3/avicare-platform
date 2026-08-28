"use client";

import { use } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { FarmDetailPanel } from "@/components/admin/FarmDetailPanel";

export default function ConsoleFarmDetailPage({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = use(params);

  return (
    <AdminShell>
      <FarmDetailPanel farmId={Number(farmId)} />
    </AdminShell>
  );
}
