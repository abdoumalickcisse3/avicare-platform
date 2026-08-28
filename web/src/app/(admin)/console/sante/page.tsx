"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { FarmsAtRisk } from "@/components/admin/FarmsAtRisk";

export default function ConsoleHealthPage() {
  return (
    <AdminShell>
      <FarmsAtRisk />
    </AdminShell>
  );
}
