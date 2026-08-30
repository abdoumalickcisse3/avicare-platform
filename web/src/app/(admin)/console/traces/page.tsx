"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { TraceExplorer } from "@/components/admin/TraceExplorer";

export default function ConsoleTracesPage() {
  return (
    <AdminShell>
      <TraceExplorer />
    </AdminShell>
  );
}
